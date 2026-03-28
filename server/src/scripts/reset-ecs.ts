import { ECSClient, DeleteClusterCommand, DeregisterTaskDefinitionCommand, ListTaskDefinitionsCommand } from "@aws-sdk/client-ecs";
import { ECRClient, DeleteRepositoryCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { IAMClient, DeleteRoleCommand, DetachRolePolicyCommand, ListAttachedRolePoliciesCommand } from "@aws-sdk/client-iam";

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
      await ecsClient.send(new DeleteClusterCommand({ cluster: "FastDeployCluster" }));
      console.log("✅ ECS Cluster deleted.");
    } catch (e) {}

    // 2. Deregister Task Definitions
    try {
      const taskDefsRes = await ecsClient.send(new ListTaskDefinitionsCommand({ familyPrefix: "fast-deploy-task" }));
      if (taskDefsRes.taskDefinitionArns) {
        for (const arn of taskDefsRes.taskDefinitionArns) {
          await ecsClient.send(new DeregisterTaskDefinitionCommand({ taskDefinition: arn }));
        }
      }
      console.log("✅ Task Definitions deregistered.");
    } catch (e) {}

    // 3. Delete ECR Repository
    try {
      await ecrClient.send(new DeleteRepositoryCommand({ repositoryName: "fast-deploy-builder", force: true }));
      console.log("✅ ECR Repository deleted.");
    } catch (e) {}

    // 4. Cleanup IAM Roles
    const roles = ["FastDeployTaskExecutionRole", "FastDeployTaskRole"];
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

    console.log("🎉 ECS Reset Complete!");
  } catch (error) {
    console.error("❌ ECS Reset failed:", error);
  }
}

resetECS();
