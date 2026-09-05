export function normalizeStarterCode(raw) {
  if (!raw) return { cpp: '', java: '' };

  if (typeof raw === 'object') {
    const cpp =
      raw.cpp ??
      raw['c++'] ??
      raw['C++'] ??
      raw.CPP ??
      raw.c ??
      '';
    const java =
      raw.java ??
      raw.Java ??
      raw.JAVA ??
      '';
    return {
      cpp: typeof cpp === 'string' ? cpp : '',
      java: typeof java === 'string' ? java : '',
    };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { cpp: '', java: '' };
    const looksLikeCpp = /#include|std::|cin\s*>>|cout\s*<<|vector<|int\s+main\s*\(/.test(trimmed);
    const looksLikeJava = /import\s+java|public\s+class|System\.out|Scanner\s+/.test(trimmed);
    if (looksLikeCpp && !looksLikeJava) return { cpp: trimmed, java: '' };
    if (looksLikeJava && !looksLikeCpp) return { cpp: '', java: trimmed };
    return { cpp: trimmed, java: trimmed };
  }

  return { cpp: '', java: '' };
}
