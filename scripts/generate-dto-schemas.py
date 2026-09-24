from pathlib import Path
import re, json
root = Path(__file__).resolve().parents[1]
schemas = {}
files = list((root/'server/src/modules').glob('*/dto/*.ts')) + [root/'server/src/modules/rbac/rbac.controller.ts']
for path in files:
    source = path.read_text(encoding='utf-8')
    for match in re.finditer(r'export class (\w+(?:Dto|Row)) \{(.*?)\n\}', source, re.S):
        name, body = match.groups()
        fields = {}
        for field in re.finditer(r'^\s*(\w+)([!?]?):\s*([^;\n]+);', body, re.M):
            key, optional, kind = field.groups()
            fields[key] = {'type':kind.strip(), 'required':optional != '?'}
        schemas[name] = fields
p = root/'server/src/common/validation/dto-schemas.ts'
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text('// Generated from request DTOs by scripts/generate-dto-schemas.py.\nexport const dtoSchemas: Record<string, Record<string, { type: string; required: boolean }>> = '+json.dumps(schemas, indent=2)+';\n', encoding='utf-8')
