export type TokenType = "LBRACE" | "RBRACE" | "IDENT" | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (char === "{") {
      tokens.push({ type: "LBRACE", value: "{" });
      i++;
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "RBRACE", value: "}" });
      i++;
      continue;
    }
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    let ident = "";
    while (i < input.length && /[a-zA-Z0-9_]/.test(input[i]!)) {
      ident += input[i++]!;
    }
    if (ident) {
      tokens.push({ type: "IDENT", value: ident });
    } else {
      i++;
    }
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}
