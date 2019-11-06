import * as nexus from "nexus";

const __globalTypeDefs: any[] = [];

export function getTypeDefs() {
  return __globalTypeDefs;
}

export function objectType<TypeName extends string>(
  config: nexus.core.NexusObjectTypeConfig<TypeName>
): nexus.core.NexusObjectTypeDef<TypeName> {
  const typeDef = nexus.objectType(config);
  __globalTypeDefs.push(typeDef);
  return typeDef;
}

export function inputObjectType<TypeName extends string>(
  config: nexus.core.NexusInputObjectTypeConfig<TypeName>
): nexus.core.NexusInputObjectTypeDef<TypeName> {
  const typeDef = nexus.inputObjectType(config);
  __globalTypeDefs.push(typeDef);
  return typeDef;
}

export function scalarType<TypeName extends string>(
  options: nexus.core.NexusScalarTypeConfig<TypeName>
): nexus.core.NexusScalarTypeDef<TypeName> {
  const typeDef = nexus.scalarType(options);
  __globalTypeDefs.push(typeDef);
  return typeDef;
}

export function enumType<TypeName extends string>(
  config: nexus.core.EnumTypeConfig<TypeName>
): nexus.core.NexusEnumTypeDef<TypeName> {
  const typeDef = nexus.enumType(config);
  __globalTypeDefs.push(typeDef);
  return typeDef;
}

export function unionType<TypeName extends string>(
  config: nexus.core.NexusUnionTypeConfig<TypeName>
): nexus.core.NexusUnionTypeDef<TypeName> {
  const typeDef = nexus.unionType(config);
  __globalTypeDefs.push(typeDef);
  return typeDef;
}
