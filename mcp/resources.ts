// coaiajs/mcp/resources.ts — MCP read-only resources
// Parity with coaiapy-mcp template resources.

import { TemplateLoader } from '../src/pipeline/index.js';

export async function listTemplates(includePath = false): Promise<Record<string, unknown>> {
  try {
    const loader = new TemplateLoader();
    return {
      success: true,
      templates: loader.listTemplates(includePath),
    };
  } catch (error) {
    return {
      success: false,
      error: `Template list error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getTemplate(name: string): Promise<Record<string, unknown>> {
  try {
    const loader = new TemplateLoader();
    const template = loader.loadTemplate(name);

    if (!template) {
      return {
        success: false,
        error: `Template '${name}' not found`,
      };
    }

    return {
      success: true,
      template,
    };
  } catch (error) {
    return {
      success: false,
      error: `Template get error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getTemplateVariables(name: string): Promise<Record<string, unknown>> {
  try {
    const loader = new TemplateLoader();
    const template = loader.loadTemplate(name);

    if (!template) {
      return {
        success: false,
        error: `Template '${name}' not found`,
      };
    }

    return {
      success: true,
      variables: template.variables ?? [],
    };
  } catch (error) {
    return {
      success: false,
      error: `Template variables error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function readCoaiaResource(uri: string): Promise<string> {
  if (uri === 'coaia://templates/') {
    return JSON.stringify(await listTemplates(), null, 2);
  }

  if (uri.startsWith('coaia://templates/')) {
    const resourcePath = uri.replace('coaia://templates/', '').replace(/\/$/, '');
    if (resourcePath.endsWith('/variables')) {
      const templateName = resourcePath.replace(/\/variables$/, '');
      return JSON.stringify(await getTemplateVariables(templateName), null, 2);
    }
    return JSON.stringify(await getTemplate(resourcePath), null, 2);
  }

  return JSON.stringify({ success: false, error: `Unknown resource URI: ${uri}` }, null, 2);
}
