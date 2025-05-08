import { ResultFormatter } from '../../../src/mcp/formatting/ResultFormatter';
import { ToolExecutionResult } from '../../../src/mcp/interfaces';

describe('ResultFormatter', () => {
  describe('format', () => {
    const successResult: ToolExecutionResult = {
      data: { key: 'value', number: 42 },
      status: 'success',
      metadata: {
        executionTime: 100
      }
    };
    
    const errorResult: ToolExecutionResult = {
      data: null,
      status: 'error',
      error: 'Test error',
      metadata: {
        errorType: 'TestError',
        executionTime: 50
      }
    };
    
    it('should format success result as JSON by default', () => {
      const formatted = ResultFormatter.format(successResult);
      const parsed = JSON.parse(formatted);
      
      expect(parsed).toEqual({
        data: { key: 'value', number: 42 },
        metadata: { executionTime: 100 }
      });
    });
    
    it('should format error result with metadata', () => {
      const formatted = ResultFormatter.format(errorResult);
      const parsed = JSON.parse(formatted);
      
      expect(parsed).toEqual({
        error: 'Test error',
        metadata: {
          errorType: 'TestError',
          executionTime: 50
        }
      });
    });
  });
  
  describe('format as text', () => {
    it('should format simple values', () => {
      const result: ToolExecutionResult = {
        data: 'Simple text',
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'text');
      expect(formatted).toBe('Simple text');
    });
    
    it('should format arrays', () => {
      const result: ToolExecutionResult = {
        data: [1, 2, 'three'],
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'text');
      expect(formatted).toBe('1\n2\nthree');
    });
    
    it('should format objects', () => {
      const result: ToolExecutionResult = {
        data: { name: 'test', value: 42 },
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'text');
      expect(formatted).toBe('name: test\nvalue: 42');
    });
  });
  
  describe('format as markdown', () => {
    it('should format arrays as lists', () => {
      const result: ToolExecutionResult = {
        data: ['first', 'second', 'third'],
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'markdown');
      expect(formatted).toBe('- first\n- second\n- third');
    });
    
    it('should format array of objects as table', () => {
      const result: ToolExecutionResult = {
        data: [
          { id: 1, name: 'First' },
          { id: 2, name: 'Second' }
        ],
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'markdown');
      expect(formatted).toContain('| id | name |');
      expect(formatted).toContain('|---|---|');
      expect(formatted).toContain('| 1 | First |');
      expect(formatted).toContain('| 2 | Second |');
    });
    
    it('should format objects with code blocks', () => {
      const result: ToolExecutionResult = {
        data: {
          title: 'Test',
          details: { complex: 'object' }
        },
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'markdown');
      expect(formatted).toContain('**title**: Test');
      expect(formatted).toContain('**details**: ```json\n{');
      expect(formatted).toContain('"complex": "object"');
      expect(formatted).toContain('```');
    });
    
    it('should format empty arrays specially', () => {
      const result: ToolExecutionResult = {
        data: [],
        status: 'success'
      };
      
      const formatted = ResultFormatter.format(result, 'markdown');
      expect(formatted).toBe('_No items_');
    });
  });
  
  describe('detectFormat', () => {
    it('should detect markdown for string with markdown syntax', () => {
      const result: ToolExecutionResult = {
        data: '# Heading\n**bold** text',
        status: 'success'
      };
      
      const format = ResultFormatter.detectFormat(result);
      expect(format).toBe('markdown');
    });
    
    it('should detect markdown for array of objects', () => {
      const result: ToolExecutionResult = {
        data: [{ id: 1 }, { id: 2 }],
        status: 'success'
      };
      
      const format = ResultFormatter.detectFormat(result);
      expect(format).toBe('markdown');
    });
    
    it('should detect json for complex objects', () => {
      const result: ToolExecutionResult = {
        data: { complex: { nested: true } },
        status: 'success'
      };
      
      const format = ResultFormatter.detectFormat(result);
      expect(format).toBe('json');
    });
    
    it('should detect text for simple values', () => {
      const result: ToolExecutionResult = {
        data: 'Simple text value',
        status: 'success'
      };
      
      const format = ResultFormatter.detectFormat(result);
      expect(format).toBe('text');
    });
  });
});
