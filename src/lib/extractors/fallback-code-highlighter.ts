import type { CodeLine, CodeToken, CodeTokenType } from "@/lib/conversation/content";

const KEYWORDS: Record<string, Set<string>> = {
  javascript: new Set(["as", "async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield"]),
  typescript: new Set(["abstract", "any", "as", "asserts", "async", "await", "break", "case", "catch", "class", "const", "constructor", "continue", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "infer", "instanceof", "interface", "is", "keyof", "let", "namespace", "new", "of", "override", "private", "protected", "public", "readonly", "return", "satisfies", "set", "static", "super", "switch", "this", "throw", "try", "type", "typeof", "var", "void", "while", "yield"]),
  cpp: new Set(["alignas", "alignof", "and", "asm", "auto", "break", "case", "catch", "class", "const", "constexpr", "continue", "default", "delete", "do", "else", "enum", "explicit", "export", "extern", "for", "friend", "if", "inline", "namespace", "new", "noexcept", "not", "operator", "private", "protected", "public", "register", "return", "sizeof", "static", "struct", "switch", "template", "this", "throw", "try", "typedef", "typename", "union", "using", "virtual", "volatile", "while"]),
  c: new Set(["auto", "break", "case", "const", "continue", "default", "do", "else", "enum", "extern", "for", "goto", "if", "inline", "register", "restrict", "return", "sizeof", "static", "struct", "switch", "typedef", "union", "volatile", "while"]),
  java: new Set(["abstract", "assert", "break", "case", "catch", "class", "const", "continue", "default", "do", "else", "enum", "extends", "final", "finally", "for", "if", "implements", "import", "instanceof", "interface", "native", "new", "package", "private", "protected", "public", "return", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "volatile", "while"]),
  python: new Set(["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"]),
  bash: new Set(["case", "do", "done", "elif", "else", "esac", "export", "fi", "for", "function", "if", "in", "local", "readonly", "return", "select", "then", "until", "while"]),
  sql: new Set(["add", "all", "alter", "and", "as", "asc", "between", "by", "case", "create", "database", "delete", "desc", "distinct", "drop", "else", "end", "exists", "from", "full", "group", "having", "in", "index", "inner", "insert", "into", "is", "join", "left", "like", "limit", "not", "null", "on", "or", "order", "outer", "primary", "references", "right", "select", "set", "table", "then", "union", "unique", "update", "values", "when", "where", "with"]),
  go: new Set(["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"]),
  rust: new Set(["as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while"])
};

const TYPE_WORDS = new Set([
  "bool", "boolean", "byte", "char", "double", "float", "int", "int16", "int32", "int64", "long", "number", "object", "short", "signed", "string", "uint", "uint16", "uint32", "uint64", "unsigned", "void"
]);

const BUILTINS = new Set([
  "Array", "Boolean", "console", "Date", "document", "Error", "JSON", "Map", "Math", "Number", "Object", "Promise", "Set", "String", "Symbol", "window",
  "cin", "cout", "endl", "printf", "scanf", "size_t", "std", "vector", "unordered_map", "unordered_set",
  "dict", "enumerate", "len", "list", "print", "range", "set", "str", "tuple"
]);

const BOOLEAN_WORDS = new Set(["true", "false", "True", "False", "null", "nullptr", "None", "undefined"]);
const OPERATORS = ["===", "!==", ">>>", "<<=", ">>=", "**=", "=>", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "??", "?.", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "**", "::", "->", "&=", "|=", "^=", "+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", ":"];
const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", ";", "."]);

function languageKey(language?: string): string {
  if (language === "jsx") return "javascript";
  if (language === "tsx") return "typescript";
  if (language === "csharp") return "java";
  return language ?? "";
}

function pushToken(tokens: CodeToken[], text: string, tokenType: CodeTokenType): void {
  if (!text) return;
  const previous = tokens[tokens.length - 1];
  if (previous && previous.tokenType === tokenType && !previous.classNames) {
    previous.text += text;
    return;
  }
  tokens.push({ text, tokenType });
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

function nextNonWhitespace(code: string, start: number): string {
  for (let i = start; i < code.length; i++) if (!/\s/.test(code[i])) return code[i];
  return "";
}

function previousNonWhitespace(code: string, start: number): string {
  for (let i = start; i >= 0; i--) if (!/\s/.test(code[i])) return code[i];
  return "";
}

function classifyWord(word: string, language: string, code: string, end: number): CodeTokenType {
  if (BOOLEAN_WORDS.has(word)) return "boolean";
  if (TYPE_WORDS.has(word)) return "type";
  if (BUILTINS.has(word)) return "builtin";
  const keywords = KEYWORDS[language];
  if (keywords?.has(language === "sql" ? word.toLowerCase() : word)) return "keyword";
  if (previousNonWhitespace(code, end - word.length - 1) === ".") return "property";
  if (nextNonWhitespace(code, end) === "(") return "function";
  return "plain";
}

function findStringEnd(code: string, start: number, quote: string): number {
  let escaped = false;
  for (let i = start + 1; i < code.length; i++) {
    const char = code[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) return i + 1;
  }
  return code.length;
}

function tokenise(code: string, language?: string): CodeToken[] {
  const lang = languageKey(language);
  const tokens: CodeToken[] = [];
  let i = 0;

  while (i < code.length) {
    const char = code[i];

    if (/\s/.test(char)) {
      let end = i + 1;
      while (end < code.length && /\s/.test(code[end])) end++;
      pushToken(tokens, code.slice(i, end), "plain");
      i = end;
      continue;
    }

    if ((lang === "html" || lang === "xml") && code.startsWith("<!--", i)) {
      const close = code.indexOf("-->", i + 4);
      const end = close === -1 ? code.length : close + 3;
      pushToken(tokens, code.slice(i, end), "comment");
      i = end;
      continue;
    }

    if ((lang === "html" || lang === "xml") && char === "<") {
      const close = code.indexOf(">", i + 1);
      const end = close === -1 ? code.length : close + 1;
      pushToken(tokens, code.slice(i, end), "tag");
      i = end;
      continue;
    }

    if (code.startsWith("/*", i)) {
      const close = code.indexOf("*/", i + 2);
      const end = close === -1 ? code.length : close + 2;
      pushToken(tokens, code.slice(i, end), "comment");
      i = end;
      continue;
    }

    if (code.startsWith("//", i) && lang !== "sql") {
      const end = code.indexOf("\n", i + 2);
      const stop = end === -1 ? code.length : end;
      pushToken(tokens, code.slice(i, stop), "comment");
      i = stop;
      continue;
    }

    if (lang === "sql" && code.startsWith("--", i)) {
      const end = code.indexOf("\n", i + 2);
      const stop = end === -1 ? code.length : end;
      pushToken(tokens, code.slice(i, stop), "comment");
      i = stop;
      continue;
    }

    if ((lang === "python" || lang === "bash") && char === "#") {
      const end = code.indexOf("\n", i + 1);
      const stop = end === -1 ? code.length : end;
      pushToken(tokens, code.slice(i, stop), "comment");
      i = stop;
      continue;
    }

    if ((lang === "cpp" || lang === "c") && char === "#") {
      const match = code.slice(i).match(/^#[A-Za-z_]+/);
      if (match) {
        pushToken(tokens, match[0], "keyword");
        i += match[0].length;
        continue;
      }
    }

    if (char === "\"" || char === "'" || char === "`") {
      const end = findStringEnd(code, i, char);
      pushToken(tokens, code.slice(i, end), "string");
      i = end;
      continue;
    }

    if (/\d/.test(char) || (char === "." && /\d/.test(code[i + 1] ?? ""))) {
      const match = code.slice(i).match(/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[uUlLfF]*/);
      if (match) {
        pushToken(tokens, match[0], "number");
        i += match[0].length;
        continue;
      }
    }

    if (isIdentifierStart(char)) {
      let end = i + 1;
      while (end < code.length && isIdentifierPart(code[end])) end++;
      const word = code.slice(i, end);
      pushToken(tokens, word, classifyWord(word, lang, code, end));
      i = end;
      continue;
    }

    const operator = OPERATORS.find((candidate) => code.startsWith(candidate, i));
    if (operator) {
      pushToken(tokens, operator, "operator");
      i += operator.length;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      pushToken(tokens, char, "punctuation");
      i++;
      continue;
    }

    pushToken(tokens, char, "plain");
    i++;
  }

  return tokens;
}

function tokensToLines(tokens: CodeToken[], code: string): CodeLine[] {
  if (!code) return [];
  const lines: CodeLine[] = [{ number: 1, tokens: [], plainText: "" }];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (part) {
        const current = lines[lines.length - 1];
        current.tokens.push({ ...token, text: part });
        current.plainText += part;
      }
      if (index < parts.length - 1) lines.push({ number: lines.length + 1, tokens: [], plainText: "" });
    });
  }
  return lines;
}

/**
 * Local, deterministic fallback used only when ChatGPT did not expose syntax
 * token classes. Concatenating the returned line text always reproduces the
 * original source exactly; highlighting changes presentation only.
 */
export function highlightCodeLines(code: string, language?: string): CodeLine[] {
  return tokensToLines(tokenise(code, language), code);
}
