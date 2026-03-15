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
            migrationBuilder.DropForeignKey(
                name: "FK_Datasets_AspNetUsers_UserId",
                table: "Datasets");
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
