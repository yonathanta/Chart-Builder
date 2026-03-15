using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChartBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReportChartLayout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Height",
                table: "ReportCharts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PositionX",
                table: "ReportCharts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PositionY",
                table: "ReportCharts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Width",
                table: "ReportCharts",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Height",
                table: "ReportCharts");

            migrationBuilder.DropColumn(
                name: "PositionX",
                table: "ReportCharts");

            migrationBuilder.DropColumn(
                name: "PositionY",
                table: "ReportCharts");

            migrationBuilder.DropColumn(
                name: "Width",
                table: "ReportCharts");
        }
    }
}
