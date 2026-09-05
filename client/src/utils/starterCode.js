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

export function getProblemStarter(p, currentLang) {
  if (!p) return '';
  const sc = p.starterCode;
  if (!sc) return '';
  if (typeof sc === 'string' && sc.trim()) return sc;
  if (typeof sc === 'object') {
    if (currentLang === 'cpp') {
      const cppCode = sc.cpp || sc['c++'] || sc['C++'] || sc.CPP || '';
      if (cppCode && cppCode.trim()) return cppCode;
    } else if (currentLang === 'java') {
      const javaCode = sc.java || sc.Java || sc.JAVA || '';
      if (javaCode && javaCode.trim()) return javaCode;
    }
    const anyCode = sc[currentLang] || sc.cpp || sc.java;
    return typeof anyCode === 'string' ? anyCode : '';
  }
  return '';
}
