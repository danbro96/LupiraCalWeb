using System.Text.Json.Nodes;

namespace LupiraCalBff.OpenApi;

/// <param name="Document">The merged OpenAPI document.</param>
/// <param name="NotExposed">Upstream operations the allowlist omits — growth nobody has reviewed yet.</param>
/// <param name="Renames">Schemas and operation ids namespaced because two upstreams disagreed.</param>
public sealed record MergeResult(JsonObject Document, IReadOnlyList<string> NotExposed, IReadOnlyList<string> Renames);
