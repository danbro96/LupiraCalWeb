using System.Text.Json;
using System.Text.Json.Nodes;

namespace LupiraCalBff.OpenApi;

/// <summary>Writes the normalized copies of the upstream specs that the C# client generator reads.</summary>
public static class UpstreamSpecRefresh
{
    /// <summary>Where the generator reads from, relative to the project directory.</summary>
    public const string NormalizedDirectory = "upstream-normalized";

    public static void WriteNormalized(string? projectDirectory)
    {
        var root = projectDirectory ?? AppContext.BaseDirectory;
        var source = FindUpstreamDirectory(root)
            ?? throw new InvalidOperationException(
                $"Could not locate an 'upstream' directory from '{root}'. Pass the project directory as the second argument.");

        var target = Path.Combine(Path.GetDirectoryName(source)!, NormalizedDirectory);
        Directory.CreateDirectory(target);

        foreach (var file in Directory.EnumerateFiles(source, "*.json").OrderBy(f => f, StringComparer.Ordinal))
        {
            var document = JsonNode.Parse(File.ReadAllText(file))?.AsObject()
                ?? throw new InvalidOperationException($"{file} is not a JSON object.");
            // TODO(kiota): see NullableRefNormalizer — this whole pass goes when the generator is fixed.
            var (normalized, collapsed) = NullableRefNormalizer.Normalize(document);
            var destination = Path.Combine(target, Path.GetFileName(file));
            File.WriteAllText(destination, normalized.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine($"{Path.GetFileName(file),-26} collapsed {collapsed} nullable-ref site(s)");
        }

        Console.WriteLine($"normalized specs written to {target}");
    }

    /// <summary>Walks up for the project's own 'upstream' folder, so the tool runs from bin/ too.</summary>
    private static string? FindUpstreamDirectory(string start)
    {
        for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "upstream");
            if (Directory.Exists(candidate)) return candidate;
        }

        return null;
    }
}
