import re
from typing import List, Dict
from app.models.schemas import CodeParseResponse


class CodeParser:
    """Service for parsing code and extracting structural information"""
    
    def parse(self, code: str, language: str, file_path: str = None) -> CodeParseResponse:
        """Parse code based on language"""
        if language.lower() in ['python', 'py']:
            return self._parse_python(code)
        elif language.lower() in ['javascript', 'js', 'typescript', 'ts']:
            return self._parse_javascript(code)
        else:
            return self._parse_generic(code, language)
    
    def _parse_python(self, code: str) -> CodeParseResponse:
        """Parse Python code"""
        imports = re.findall(r'^(?:from|import)\s+[\w.]+', code, re.MULTILINE)
        functions = re.findall(r'^def\s+(\w+)\s*\(', code, re.MULTILINE)
        classes = re.findall(r'^class\s+(\w+)', code, re.MULTILINE)
        
        lines_of_code = len([line for line in code.split('\n') if line.strip()])
        complexity = self._calculate_cyclomatic_complexity(code)
        
        return CodeParseResponse(
            language='python',
            imports=imports,
            functions=functions,
            classes=classes,
            complexity=complexity,
            lines_of_code=lines_of_code
        )
    
    def _parse_javascript(self, code: str) -> CodeParseResponse:
        """Parse JavaScript/TypeScript code"""
        imports = re.findall(r'^import\s+.+', code, re.MULTILINE)
        functions = re.findall(r'function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*\(.*\)\s*=>', code, re.MULTILINE)
        classes = re.findall(r'^class\s+(\w+)', code, re.MULTILINE)
        
        # Flatten function matches
        functions = [f[0] or f[1] for f in functions if f[0] or f[1]]
        
        lines_of_code = len([line for line in code.split('\n') if line.strip()])
        complexity = self._calculate_cyclomatic_complexity(code)
        
        return CodeParseResponse(
            language='javascript',
            imports=imports,
            functions=functions,
            classes=classes,
            complexity=complexity,
            lines_of_code=lines_of_code
        )
    
    def _parse_generic(self, code: str, language: str) -> CodeParseResponse:
        """Generic parser for unsupported languages"""
        lines_of_code = len([line for line in code.split('\n') if line.strip()])
        
        return CodeParseResponse(
            language=language,
            imports=[],
            functions=[],
            classes=[],
            complexity=0,
            lines_of_code=lines_of_code
        )
    
    def _calculate_cyclomatic_complexity(self, code: str) -> int:
        """Calculate cyclomatic complexity (simplified)"""
        # Count decision points
        decision_keywords = ['if', 'elif', 'else', 'for', 'while', 'case', 'catch']
        complexity = 1  # Base complexity
        
        for keyword in decision_keywords:
            complexity += len(re.findall(rf'\b{keyword}\b', code))
        
        return complexity
