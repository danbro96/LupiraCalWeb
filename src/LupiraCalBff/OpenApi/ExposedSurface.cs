using System.Text.Json;
using System.Text.Json.Serialization;

namespace LupiraCalBff.OpenApi;

/// <summary>
/// Every <c>VERB /path</c> the BFF forwards. A positive list, so an endpoint an upstream grows later
/// stays invisible until someone adds a line.
/// </summary>
public sealed class ExposedSurface
{
    /// <summary>Where each upstream is mounted on the BFF.</summary>
    public static readonly IReadOnlyDictionary<string, string> ClusterPrefixes = new Dictionary<string, string>
    {
        ["cal-api"] = "/api",
        ["contact-api"] = "/contact-api",
        ["geo-api"] = "/geo-api",
        ["tasks-api"] = "/tasks-api",
        ["location-api"] = "/location-api",
        ["photo-api"] = "/photo-api",
        ["comms-api"] = "/comms-api",
    };

    [JsonPropertyName("operations")]
    public Dictionary<string, List<string>> Operations { get; init; } = [];

    /// <summary>Read-only file subtrees an upstream serves outside OpenAPI (glyphs, sprites, tiles).</summary>
    [JsonPropertyName("static")]
    public Dictionary<string, List<string>> Static { get; init; } = [];

    /// <summary>Device-credential surfaces: routed, but never part of the client's contract.</summary>
    [JsonPropertyName("device")]
    public Dictionary<string, List<string>> Device { get; init; } = [];

    public static ExposedSurface Load()
    {
        using var stream = typeof(ExposedSurface).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} is missing.");
        return JsonSerializer.Deserialize<ExposedSurface>(stream)
            ?? throw new InvalidOperationException($"{ResourceName} did not deserialize.");
    }

    private const string ResourceName = "LupiraCalBff.exposed.json";
}
