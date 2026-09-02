using System.Text.Json.Nodes;
using LupiraCalBff.OpenApi;
using Xunit;

namespace LupiraCalBff.UnitTests;

/// <summary>
/// The merged document is what both the client and Scalar read, so the allowlist has to be the only
/// thing that decides what appears in it — and every operation has to carry a resolvable credential.
/// </summary>
public class UpstreamSpecMergerTests
{
    private static readonly MergeResult Merged = UpstreamSpecMerger.Merge(ExposedSurface.Load());

    private static IEnumerable<(string Path, string Verb, JsonObject Operation)> Operations()
    {
        foreach (var (path, item) in Merged.Document["paths"]!.AsObject())
        {
            foreach (var (verb, node) in item!.AsObject())
            {
                if (node is JsonObject operation && operation.ContainsKey("responses"))
                    yield return (path, verb, operation);
            }
        }
    }

    [Fact]
    public void Every_operation_declares_a_scheme_the_document_defines()
    {
        var declared = Merged.Document["components"]!["securitySchemes"]!.AsObject()
            .Select(s => s.Key).ToHashSet(StringComparer.Ordinal);

        Assert.NotEmpty(declared);
        foreach (var (path, verb, operation) in Operations())
        {
            var requirements = operation["security"]?.AsArray();
            Assert.NotNull(requirements);

            // An empty requirement object reads as "callable unauthenticated" — it is what a dangling
            // scheme reference degrades to on write.
            Assert.NotEmpty(requirements!);
            foreach (var requirement in requirements!)
            {
                var named = requirement!.AsObject().Select(r => r.Key).ToList();
                Assert.NotEmpty(named);
                Assert.All(named, name => Assert.Contains(name, declared));
            }
        }
    }

    [Fact]
    public void Only_allowlisted_operations_appear()
    {
        var exposed = ExposedSurface.Load();
        var allowed = exposed.Operations
            .SelectMany(g => g.Value.Select(op =>
            {
                var parts = op.Split(' ', 2);
                return $"{parts[0]} {ExposedSurface.ClusterPrefixes[g.Key]}{parts[1]}";
            }))
            .ToHashSet(StringComparer.Ordinal);

        var present = Operations().Select(o => $"{o.Verb.ToUpperInvariant()} {o.Path}").ToList();

        Assert.Equal(allowed.Count, present.Count);
        Assert.Empty(present.Except(allowed, StringComparer.Ordinal));
    }

    [Fact]
    public void The_device_ingest_surface_stays_out_of_the_document()
    {
        // The generated client can only express Bearer, which is why the uploader is hand-written.
        var device = ExposedSurface.Load().Device
            .SelectMany(g => g.Value.Select(entry => entry.Split(' ', 2)[1]))
            .ToList();

        Assert.NotEmpty(device);
        Assert.Empty(Operations().Select(o => o.Path).Intersect(device, StringComparer.Ordinal));
    }

    [Fact]
    public void Every_referenced_schema_is_defined()
    {
        var defined = Merged.Document["components"]!["schemas"]!.AsObject()
            .Select(s => s.Key).ToHashSet(StringComparer.Ordinal);

        var referenced = new List<string>();
        Collect(Merged.Document, referenced);

        Assert.Empty(referenced.Distinct(StringComparer.Ordinal).Except(defined, StringComparer.Ordinal));
    }

    private static void Collect(JsonNode node, List<string> refs)
    {
        const string prefix = "#/components/schemas/";
        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj)
                {
                    if (key == "$ref" && value?.GetValue<string>() is { } reference
                        && reference.StartsWith(prefix, StringComparison.Ordinal))
                    {
                        refs.Add(reference[prefix.Length..]);
                    }
                    else if (value is not null)
                    {
                        Collect(value, refs);
                    }
                }

                break;
            case JsonArray array:
                foreach (var value in array)
                    if (value is not null) Collect(value, refs);
                break;
        }
    }
}
