namespace LupiraCalBff.Dtos;

public sealed class ContactGroupRefDto
{
    public required Guid Id { get; set; }

    public required string Name { get; set; }

    /// <summary>`Organization` renders differently from a plain group.</summary>
    public required string Kind { get; set; }
}
