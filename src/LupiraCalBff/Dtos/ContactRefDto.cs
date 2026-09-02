namespace LupiraCalBff.Dtos;

public sealed class ContactRefDto
{
    public required Guid Id { get; set; }

    /// <summary>Falls back to the id's first characters when the contact is unreadable or gone.</summary>
    public required string Name { get; set; }
}
