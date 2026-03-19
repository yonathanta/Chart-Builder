using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChartBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardStudioStateJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ComponentsJson",
                table: "Dashboards",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "LayoutJson",
                table: "Dashboards",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<string>(
                name: "PageStructureJson",
                table: "Dashboards",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "SnapshotJson",
                table: "Dashboards",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ComponentsJson",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "LayoutJson",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "PageStructureJson",
                table: "Dashboards");

            migrationBuilder.DropColumn(
                name: "SnapshotJson",
                table: "Dashboards");
        }
    }
}
