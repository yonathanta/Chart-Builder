using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChartBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDatasetAspNetUserForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Datasets_AspNetUsers_UserId'
)
BEGIN
    ALTER TABLE [Datasets] DROP CONSTRAINT [FK_Datasets_AspNetUsers_UserId];
END;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddForeignKey(
                name: "FK_Datasets_AspNetUsers_UserId",
                table: "Datasets",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
