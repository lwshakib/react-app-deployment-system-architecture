import { generateSlug } from "random-word-slugs";
import { postgresService } from "../services/postgres.service";

/**
 * Helper: Extract repo name from Git URL
 */
export function getRepoName(gitURL: string): string {
  try {
    const url = new URL(gitURL);
    return url.pathname.split("/").pop()?.replace(".git", "") || "project";
  } catch {
    return "project";
  }
}

/**
 * Helper: Ensure unique subdomain
 */
export async function generateUniqueSubDomain(baseName: string): Promise<string> {
  let subDomain = baseName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const checkQuery = "SELECT id FROM projects WHERE sub_domain = $1";
    const res = await postgresService.query(checkQuery, [subDomain]);
    if (res.rowCount === 0) isUnique = true;
    else {
      attempts++;
      subDomain = `${baseName}-${generateSlug(1)}`.toLowerCase().replace(/[^a-z0-9]/g, "-");
    }
  }
  return isUnique ? subDomain : `${subDomain}-${Math.floor(Math.random() * 1000)}`;
}
