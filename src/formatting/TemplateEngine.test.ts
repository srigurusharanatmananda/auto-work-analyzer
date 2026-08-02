import { describe, expect, test } from "bun:test";
import {
  renderTemplate,
  validateTemplate,
  TemplateError,
  AllowedSchema,
} from "./TemplateEngine.js";

const SCHEMA: AllowedSchema = {
  scalars: ["title", "priority"],
  sections: {
    commits: { scalars: ["shortHash", "message"], sections: {} },
    tags: { scalars: ["."], sections: {} },
  },
};

describe("renderTemplate", () => {
  test("substitutes scalars", () => {
    const out = renderTemplate("{{title}} [{{priority}}]", { title: "Fix login", priority: "HIGH" }, SCHEMA);
    expect(out).toBe("Fix login [HIGH]");
  });

  test("renders a section once per array element", () => {
    const out = renderTemplate(
      "{{#commits}}{{shortHash}} {{message}}\n{{/commits}}",
      { commits: [ { shortHash: "abc1234", message: "one" }, { shortHash: "def5678", message: "two" } ] },
      SCHEMA
    );
    expect(out).toBe("abc1234 one\ndef5678 two\n");
  });

  test("renders nothing for an empty array section", () => {
    expect(renderTemplate("A{{#commits}}X{{/commits}}B", { commits: [] }, SCHEMA)).toBe("AB");
  });

  test("a section over a truthy scalar acts as a guard", () => {
    expect(renderTemplate("{{#title}}has title{{/title}}", { title: "x" }, SCHEMA)).toBe("has title");
    expect(renderTemplate("{{#title}}has title{{/title}}", { title: "" }, SCHEMA)).toBe("");
  });

  test("inverted section renders only when falsy or empty", () => {
    expect(renderTemplate("{{^commits}}no commits{{/commits}}", { commits: [] }, SCHEMA)).toBe("no commits");
    expect(renderTemplate("{{^commits}}no commits{{/commits}}", { commits: [{}] }, SCHEMA)).toBe("");
  });

  test("{{.}} renders the current element of a scalar array", () => {
    expect(renderTemplate("{{#tags}}#{{.}} {{/tags}}", { tags: ["api", "auth"] }, SCHEMA)).toBe("#api #auth ");
  });

  test("a missing but allowed scalar renders as empty string", () => {
    expect(renderTemplate("[{{priority}}]", {}, SCHEMA)).toBe("[]");
  });

  test("an unknown placeholder throws TemplateError naming it", () => {
    expect(() => renderTemplate("{{nope}}", {}, SCHEMA)).toThrow(TemplateError);
    try {
      renderTemplate("{{nope}}", {}, SCHEMA);
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.placeholder).toBe("nope");
      expect(templateError.valid).toContain("title");
    }
  });

  test("an unclosed section throws", () => {
    expect(() => renderTemplate("{{#commits}}x", {}, SCHEMA)).toThrow(TemplateError);
  });

  test("a mismatched closing tag throws", () => {
    expect(() => renderTemplate("{{#commits}}x{{/tags}}", {}, SCHEMA)).toThrow(TemplateError);
  });

  test("braces inside substituted data are not re-interpreted", () => {
    const out = renderTemplate("{{title}}", { title: "fix {{priority}} parsing" }, SCHEMA);
    expect(out).toBe("fix {{priority}} parsing");
  });
});

describe("validateTemplate", () => {
  test("returns no errors for a valid template", () => {
    expect(validateTemplate("{{title}}{{#commits}}{{message}}{{/commits}}", SCHEMA)).toEqual([]);
  });

  test("reports an unknown scalar", () => {
    const errors = validateTemplate("{{bogus}}", SCHEMA);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("bogus");
  });

  test("reports an unknown scalar inside a section", () => {
    const errors = validateTemplate("{{#commits}}{{author}}{{/commits}}", SCHEMA);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("author");
  });

  test("reports an unknown section", () => {
    expect(validateTemplate("{{#nope}}x{{/nope}}", SCHEMA).length).toBe(1);
  });
});
