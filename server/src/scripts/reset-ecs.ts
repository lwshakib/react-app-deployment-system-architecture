import { ECSClient, DeleteClusterCommand, DeregisterTaskDefinitionCommand, ListTaskDefinitionsCommand, ListTasksCommand, StopTaskCommand } from "@aws-sdk/client-ecs";
import { ECRClient, DeleteRepositoryCommand } from "@aws-sdk/client-ecr";
import { IAMClient, DeleteRoleCommand, DetachRolePolicyCommand, ListAttachedRolePoliciesCommand } from "@aws-sdk/client-iam";
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY } from "../envs";
import path from "path";
import logger from "../logger/winston.logger";
import { updateEnv } from "../utils/env-updater";

const region = AWS_REGION;
const accessKeyId = AWS_ACCESS_KEY_ID;
const secretAccessKey = AWS_SECRET_ACCESS_KEY;

if (!region || !accessKeyId || !secretAccessKey) {
  logger.error("❌ Missing AWS environment variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).");
  process.exit(1);
}

const credentials = { accessKeyId, secretAccessKey };
const ecsClient = new ECSClient({ region, credentials });
const ecrClient = new ECRClient({ region, credentials });
const iamClient = new IAMClient({ region, credentials });

async function resetECS() {
  logger.info("🔥 Resetting ECS, ECR, and IAM infrastructure...");

  try {
    // 1. Teardown ECS Cluster
    try {
      await ecsClient.send(new DeleteClusterCommand({ cluster: "react-app-deploy-cluster" }));
      logger.info("✅ ECS Cluster deleted.");
    } catch (e) {}

    // 2. Deregister Task Definitions
    try {
      const taskDefsRes = await ecsClient.send(new ListTaskDefinitionsCommand({ familyPrefix: "react-app-deploy-task" }));
      if (taskDefsRes.taskDefinitionArns) {
        for (const arn of taskDefsRes.taskDefinitionArns) {
          await ecsClient.send(new DeregisterTaskDefinitionCommand({ taskDefinition: arn }));
        }
      }
      logger.info("✅ Task Definitions deregistered.");
    } catch (e) {}

    // 3. Delete ECR Repository
    try {
      await ecrClient.send(new DeleteRepositoryCommand({ repositoryName: "build-container", force: true }));
      logger.info("✅ ECR Repository deleted.");
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
        logger.info(`✅ IAM Role ${roleName} deleted.`);
      } catch (e) {}
    }

    // .env Update with placeholders
    updateEnv("ECS_CLUSTER_ARN", "arn:aws:ecs:ap-south-1:YOUR_ACCOUNT_ID:cluster/YOUR_CLUSTER_NAME");
    updateEnv("ECS_TASK_DEFINITION_ARN", "arn:aws:ecs:ap-south-1:YOUR_ACCOUNT_ID:task-definition/YOUR_TASK_NAME:REVISION");
    updateEnv("ECS_CONTAINER_NAME", "build-container");
    updateEnv("ECS_SUBNETS", "subnet-...,subnet-...");
    updateEnv("ECS_SECURITY_GROUPS", "sg-...");
    logger.info("✅ .env file updated with placeholders for ECS.");

    logger.info("🎉 ECS Reset Complete!");
  } catch (error) {
    logger.error("❌ ECS Reset failed:", error);
  }
}

resetECS().then(() => {
  process.exit(0);
});
