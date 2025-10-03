export interface Env extends Cloudflare.Env {
  GITHUB_TOKEN: string;
  ROADMAP_GIT_ISSUES_CACHE: KVNamespace;
}
