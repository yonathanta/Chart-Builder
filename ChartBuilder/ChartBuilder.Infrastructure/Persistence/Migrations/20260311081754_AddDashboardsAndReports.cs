using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChartBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardsAndReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Reports",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Reports",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Dashboards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Dashboards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Dashboards_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReportCharts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChartId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportCharts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportCharts_Charts_ChartId",
                        column: x => x.ChartId,
                        principalTable: "Charts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_ReportCharts_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DashboardCharts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DashboardId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChartId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PositionX = table.Column<int>(type: "int", nullable: false),
                    PositionY = table.Column<int>(type: "int", nullable: false),
                    Width = table.Column<int>(type: "int", nullable: false),
                    Height = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DashboardCharts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DashboardCharts_Charts_ChartId",
                        column: x => x.ChartId,
                        principalTable: "Charts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_DashboardCharts_Dashboards_DashboardId",
                        column: x => x.DashboardId,
                        principalTable: "Dashboards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DashboardCharts_ChartId",
                table: "DashboardCharts",
                column: "ChartId");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardCharts_DashboardId",
                table: "DashboardCharts",
                column: "DashboardId");

            migrationBuilder.CreateIndex(
                name: "IX_DashboardCharts_DashboardId_ChartId",
                table: "DashboardCharts",
                columns: new[] { "DashboardId", "ChartId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Dashboards_ProjectId",
                table: "Dashboards",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Dashboards_UpdatedAt",
                table: "Dashboards",
                column: "UpdatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ReportCharts_ChartId",
                table: "ReportCharts",
                column: "ChartId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportCharts_ReportId",
                table: "ReportCharts",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportCharts_ReportId_ChartId",
                table: "ReportCharts",
                columns: new[] { "ReportId", "ChartId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReportCharts_ReportId_OrderIndex",
                table: "ReportCharts",
                columns: new[] { "ReportId", "OrderIndex" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DashboardCharts");

            migrationBuilder.DropTable(
                name: "ReportCharts");

            migrationBuilder.DropTable(
                name: "Dashboards");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Reports");
        }
    }
}
