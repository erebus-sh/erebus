// tables/index.ts
import { user_profiles } from "./user_profiles";
import { projects } from "./projects";
import { api_keys } from "./api_keys";
import { usage } from "./usage";
import { audit_log } from "./audit_log";

const allScheams = {
  user_profiles,
  projects,
  api_keys,
  usage,
  audit_log,
};

export default allScheams;
