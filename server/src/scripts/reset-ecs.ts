import { ECSClient, DeleteClusterCommand, DeregisterTaskDefinitionCommand, ListTaskDefinitionsCommand } from "@aws-sdk/client-ecs";
import { ECRClient, DeleteRepositoryCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { IAMClient, DeleteRoleCommand, DetachRolePolicyCommand, ListAttachedRolePoliciesCommand } from "@aws-sdk/client-iam";
import fs from "fs";
import path from "path";

const region = process.env.AWS_REGION || "ap-south-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

const credentials = { accessKeyId, secretAccessKey };
const ecsClient = new ECSClient({ region, credentials });
const ecrClient = new ECRClient({ region, credentials });
const iamClient = new IAMClient({ region, credentials });

async function resetECS() {
  console.log("🔥 Resetting ECS, ECR, and IAM infrastructure...");

  try {
    // 1. Teardown ECS Cluster
    try {
      await ecsClient.send(new DeleteClusterCommand({ cluster: "react-app-deploy-cluster" }));
      console.log("✅ ECS Cluster deleted.");
    } catch (e) {}

    // 2. Deregister Task Definitions
    try {
      const taskDefsRes = await ecsClient.send(new ListTaskDefinitionsCommand({ familyPrefix: "react-app-deploy-task" }));
      if (taskDefsRes.taskDefinitionArns) {
        for (const arn of taskDefsRes.taskDefinitionArns) {
          await ecsClient.send(new DeregisterTaskDefinitionCommand({ taskDefinition: arn }));
        }
      }
      console.log("✅ Task Definitions deregistered.");
    } catch (e) {}

    // 3. Delete ECR Repository
    try {
      await ecrClient.send(new DeleteRepositoryCommand({ repositoryName: "build-container", force: true }));
      console.log("✅ ECR Repository deleted.");
    } catch (e) {}

    // 4. Cleanup IAM Roles
    const roles = ["ReactAppDeployTaskExecutionRole", "ReactAppDeployTaskRole"];
    for (const roleName of roles) {
      try {
        const policiesRes = await iamClient.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }));
        if (policiesRes.AttachedPolicies) {
          for (const policy of policiesRes.AttachedPolicies) {
            await iamClient.send(new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policy.PolicyArn }));
          }
        }
        await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
        console.log(`✅ IAM Role ${roleName} deleted.`);
      } catch (e) {}
    }

    // .env Cleanup
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf-8");
      
      // Remove automated ECS block
      envContent = envContent.replace(/\n?# \[AUTOMATED - ECS\][\s\S]*?(?=\n# |$)/g, "").trim();
      
      // Cleanup any orphaned variables
      const ecsKeys = ["ECS_CLUSTER_ARN", "ECS_TASK_DEFINITION_ARN", "ECS_SUBNETS", "ECS_SECURITY_GROUPS"];
      ecsKeys.forEach(key => {
          envContent = envContent.replace(new RegExp(`^${key}=.*\\n?`, 'gm'), '');
      });

      fs.writeFileSync(envPath, envContent.trim() + "\n");
      console.log("✅ .env file cleaned up for ECS.");
    }

    console.log("🎉 ECS Reset Complete!");
  } catch (error) {
    console.error("❌ ECS Reset failed:", error);
  }
}

resetECS();
