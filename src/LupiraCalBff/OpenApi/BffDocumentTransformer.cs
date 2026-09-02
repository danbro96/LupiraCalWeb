using System.Text;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi;

namespace LupiraCalBff.OpenApi;

/// <summary>
/// Fills the BFF's OpenAPI document from the upstreams it proxies — YARP routes carry no schemas of
/// their own, so nothing would describe the surface.
/// </summary>
public sealed class BffDocumentTransformer(ILogger<BffDocumentTransformer> logger) : IOpenApiDocumentTransformer
{
    public async Task TransformAsync(
        OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        var merged = UpstreamSpecMerger.Merge(ExposedSurface.Load());

        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(merged.Document.ToJsonString()));
        var read = await OpenApiDocument.LoadAsync(stream, "json", cancellationToken: cancellationToken);
        if (read.Diagnostic?.Errors.Count > 0)
            throw new InvalidOperationException(
                $"Merged document is invalid: {string.Join("; ", read.Diagnostic.Errors.Select(e => e.Message))}");

        var source = read.Document!;
        document.Info = source.Info;
        document.Paths = source.Paths;
        document.Components = source.Components;

        if (merged.Renames.Count > 0)
            logger.LogInformation("OpenAPI: namespaced {Count} conflict(s): {Renames}", merged.Renames.Count, string.Join(", ", merged.Renames));
        if (merged.NotExposed.Count > 0)
            logger.LogInformation("OpenAPI: {Count} upstream operation(s) not exposed — add to exposed.json to publish", merged.NotExposed.Count);

        logger.LogInformation("OpenAPI: {Paths} paths, {Schemas} schemas", source.Paths.Count, source.Components?.Schemas?.Count ?? 0);
    }
}
