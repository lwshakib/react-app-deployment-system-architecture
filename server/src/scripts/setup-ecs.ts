import { ECSClient, CreateClusterCommand, RegisterTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";
import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, GetRoleCommand } from "@aws-sdk/client-iam";
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import fs from "fs";
import path from "path";

const region = process.env.AWS_REGION || "ap-south-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!region || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).");
  process.exit(1);
}

const credentials = { accessKeyId, secretAccessKey };
const ecsClient = new ECSClient({ region, credentials });
const ecrClient = new ECRClient({ region, credentials });
const iamClient = new IAMClient({ region, credentials });
const ec2Client = new EC2Client({ region, credentials });

async function getOrCreateRole(roleName: string, assumeRolePolicyDocument: string) {
  try {
    const roleRes = await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`ℹ️ IAM Role ${roleName} already exists.`);
    if (!roleRes.Role || !roleRes.Role.Arn) {
      throw new Error(`❌ Role ${roleName} found but Arn is missing.`);
    }
    return roleRes.Role.Arn;
  } catch (error: any) {
    if (error.name === "NoSuchEntityException" || error.name === "NoSuchEntity") {
      console.log(`🔧 Creating IAM Role: ${roleName}...`);
      const createRes = await iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
      }));
      
      // Wait to allow IAM role to propagate
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (!createRes.Role || !createRes.Role.Arn) {
        throw new Error("❌ Role created but Arn is missing.");
      }
      return createRes.Role.Arn;
    }
    throw error;
  }
}

import { execSync } from "child_process";

// Helper function to handle Docker push
async function autoPushDockerImage(repositoryUri: string) {
    console.log(`\n🐳 Authenticating Docker with AWS ECR...`);
    const authRes = await ecrClient.send(new GetAuthorizationTokenCommand({}));
    if (!authRes.authorizationData || authRes.authorizationData.length === 0) {
        throw new Error("❌ No authorization data returned from ECR");
    }
    
    const authData = authRes.authorizationData[0];
    if (!authData || !authData.authorizationToken || !authData.proxyEndpoint) {
        throw new Error("❌ Malformed authorization data returned from ECR");
    }
    
    // Token is Base64 encoded "AWS:password"
    const decodedToken = Buffer.from(authData.authorizationToken, "base64").toString("utf-8");
    const parts = decodedToken.split(":");
    if (parts.length < 2) {
        throw new Error("❌ Decoded authorization token is malformed");
    }
    const password = parts[1];
    const endpoint = authData.proxyEndpoint;

    console.log(`🔐 Logging into ECR: ${endpoint}...`);
    execSync(`docker login --username AWS --password ${password} ${endpoint}`, { stdio: "inherit" });

    console.log(`\n🔨 Building Docker image: fast-deploy-builder:latest...`);
    const buildContext = path.join(process.cwd(), "..", "build-container");
    execSync(`docker build -t fast-deploy-builder:latest ${buildContext}`, { stdio: "inherit" });

    console.log(`🏷️ Tagging local image...`);
    execSync(`docker tag fast-deploy-builder:latest ${repositoryUri}:latest`, { stdio: "inherit" });

    console.log(`🚀 Pushing image to ECR (This will take a few minutes)...`);
    execSync(`docker push ${repositoryUri}:latest`, { stdio: "inherit" });
    
    console.log(`✅ Image automatically pushed to ECR!`);
}

async function setupECS() {
  console.log("🚀 Starting comprehensive AWS ECS Fargate setup...");

  try {
    // 1. Setup IAM Roles
    const ecsAssumeRolePolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole"
      }]
    });

    const executionRoleArn = await getOrCreateRole("FastDeployTaskExecutionRole", ecsAssumeRolePolicy);
    await iamClient.send(new AttachRolePolicyCommand({
      RoleName: "FastDeployTaskExecutionRole",
      PolicyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    }));

    const taskRoleArn = await getOrCreateRole("FastDeployTaskRole", ecsAssumeRolePolicy);
    // Grant AdministratorAccess to TaskRole for simplicity (S3, SQS, Logs, etc). In production, scope this down.
    await iamClient.send(new AttachRolePolicyCommand({
      RoleName: "FastDeployTaskRole",
      PolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess"
    }));
    console.log("✅ IAM Roles configured.");

    // 2. Setup ECR Repository
    let repositoryUri = "";
    try {
      const ecrRes = await ecrClient.send(new DescribeRepositoriesCommand({ repositoryNames: ["fast-deploy-builder"] }));
      const repos = ecrRes.repositories;
      const firstRepo = repos?.[0];
      if (!firstRepo || !firstRepo.repositoryUri) {
        throw new Error("❌ ECR repository found but URI is missing.");
      }
      repositoryUri = firstRepo.repositoryUri;
      console.log(`ℹ️ ECR Repo fast-deploy-builder exists.`);
    } catch (error: any) {
      if (error.name === "RepositoryNotFoundException") {
        console.log(`🔧 Creating ECR Repository: fast-deploy-builder...`);
        const createEcr = await ecrClient.send(new CreateRepositoryCommand({ repositoryName: "fast-deploy-builder" }));
        const repo = createEcr.repository;
        if (!repo || !repo.repositoryUri) {
          throw new Error("❌ ECR repository created but URI is missing.");
        }
        repositoryUri = repo.repositoryUri;
      } else throw error;
    }
    const containerImageUri = `${repositoryUri}:latest`;
    console.log(`✅ ECR URI: ${containerImageUri}`);

    // 🔥 AUTOMATICALLY PUSH IMAGE TO ECR
    await autoPushDockerImage(repositoryUri);

    // 3. Create ECS Cluster
    console.log(`🔧 Creating ECS Cluster: FastDeployCluster...`);
    const clusterRes = await ecsClient.send(new CreateClusterCommand({ clusterName: "FastDeployCluster" }));
    const cluster = clusterRes.cluster;
    if (!cluster || !cluster.clusterArn) {
      throw new Error("❌ ECS Cluster created but Arn is missing.");
    }
    const clusterArn = cluster.clusterArn;
    console.log(`✅ ECS Cluster created / verified.`);

    // 4. Register Task Definition
    console.log(`🔧 Registering ECS Task Definition: fast-deploy-task...`);
    const taskDefRes = await ecsClient.send(new RegisterTaskDefinitionCommand({
        family: "fast-deploy-task",
        cpu: "256", // 0.25 vCPU
        memory: "512", // 0.5 GB RAM
        networkMode: "awsvpc",
        requiresCompatibilities: ["FARGATE"],
        executionRoleArn,
        taskRoleArn,
        containerDefinitions: [
            {
                name: "builder",
                image: containerImageUri,
                essential: true,
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": "/ecs/fast-deploy-task",
                        "awslogs-region": region,
                        "awslogs-stream-prefix": "ecs"
                    }
                }
            }
        ]
    }));
    const taskDef = taskDefRes.taskDefinition;
    if (!taskDef || !taskDef.taskDefinitionArn) {
      throw new Error("❌ ECS Task Definition registered but Arn is missing.");
    }
    const taskDefArn = taskDef.taskDefinitionArn;
    console.log(`✅ ECS Task Definition registered.`);

    // 5. Fetch Default VPC Subnets & Security Groups
    console.log(`🔍 Auto-discovering Default VPC networking...`);
    const vpcs = await ec2Client.send(new DescribeVpcsCommand({ Filters: [{ Name: "isDefault", Values: ["true"] }] }));
    const vpc = vpcs.Vpcs?.[0];
    if (!vpc || !vpc.VpcId) throw new Error("No default VPC found in this region.");
    const defaultVpcId = vpc.VpcId;
    console.log(`🔍 Default VPC ID: ${defaultVpcId}`);

    const subnets = await ec2Client.send(new DescribeSubnetsCommand({ Filters: [{ Name: "vpc-id", Values: [defaultVpcId] }] }));
    const subnetIds = (subnets.Subnets || []).map(s => s.SubnetId).filter((id): id is string => !!id).join(",");

    const securityGroups = await ec2Client.send(new DescribeSecurityGroupsCommand({ Filters: [{ Name: "vpc-id", Values: [defaultVpcId] }, { Name: "group-name", Values: ["default"] }] }));
    const securityGroupId = securityGroups.SecurityGroups?.[0]?.GroupId || "";
    console.log(`✅ Discovered Network details.`);

    // 6. Update .env file
    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

    const updateEnv = (key: string, value: string) => {
        if (envContent.includes(`${key}=`)) {
            envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), `${key}='${value}'`);
        } else {
            envContent += `\n${key}='${value}'\n`;
        }
    };

    updateEnv("ECS_CLUSTER_ARN", clusterArn);
    updateEnv("ECS_TASK_DEFINITION_ARN", taskDefArn);
    updateEnv("ECS_SUBNETS", subnetIds);
    updateEnv("ECS_SECURITY_GROUPS", securityGroupId);

    fs.writeFileSync(envPath, envContent);
    console.log(`\n🎉 ECS Setup Complete! Your server/.env was automatically updated!`);
    console.log(`✅ The infrastructure and ECR image are fully deployed and ready for use!`);
    
  } catch (error) {
    console.error("❌ ECS Setup failed:", error);
    process.exit(1);
  }
}

setupECS().then(() => {
  process.exit(0);
});
