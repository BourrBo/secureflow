const BACKEND_URL = "http://127.0.0.1:8000";

export type ContainerFinding = {
  title: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  rule: string;
  cwe: string;
  owasp: string;
  scanner: string;
  installed_version?: string | null;
  fixed_version?: string | null;
  cvss?: number | null;
  ecosystem?: string | null;
  iso27001_control?: string;
  iso27001_control_name?: string;
  iso27001_description?: string;
};

export async function scanContainerImage(
  imageName: string
): Promise<ContainerFinding[]> {

  const response = await fetch(
    `${BACKEND_URL}/api/container/scan`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_name: imageName,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}