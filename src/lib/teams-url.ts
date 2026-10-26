export function buildTeamsApiUrl(
  teamsApi: string,
  input: { name: string; mailId: string; desc: string },
) {
  const url = new URL(teamsApi);
  url.searchParams.set("Name", input.name);
  url.searchParams.set("MailID", input.mailId);
  url.searchParams.set("Desc", input.desc);
  return url.toString();
}
