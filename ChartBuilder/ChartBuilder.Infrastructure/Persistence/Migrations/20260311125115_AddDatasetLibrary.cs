using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChartBuilder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDatasetLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Dataset",
                table: "Charts",
                newName: "StyleJson");

            migrationBuilder.RenameColumn(
                name: "Configuration",
                table: "Charts",
                newName: "ConfigJson");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Charts",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "ChartType",
                table: "Charts",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<Guid>(
                name: "DatasetId",
                table: "Charts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Datasets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    DataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Datasets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Datasets_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(@"
INSERT INTO [Datasets] ([Id], [Name], [Description], [ProjectId], [UserId], [DataJson], [SourceType], [CreatedAt])
SELECT
    c.[Id],
    CONCAT('Migrated Dataset - ', c.[Name]),
    NULL,
    c.[ProjectId],
    COALESCE(CONVERT(nvarchar(450), p.[UserId]), N'migration'),
    c.[StyleJson],
    'Manual',
    SYSUTCDATETIME()
FROM [Charts] c
LEFT JOIN [Projects] p ON p.[Id] = c.[ProjectId];

UPDATE [Charts]
SET [DatasetId] = [Id]
WHERE [DatasetId] IS NULL;

IF EXISTS (SELECT 1 FROM [Charts] WHERE [DatasetId] IS NULL)
BEGIN
    THROW 50002, 'Failed to backfill DatasetId for one or more charts.', 1;
END;
");

            migrationBuilder.AlterColumn<Guid>(
                name: "DatasetId",
                table: "Charts",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Charts_DatasetId",
                table: "Charts",
                column: "DatasetId");

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_ProjectId",
                table: "Datasets",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_UserId",
                table: "Datasets",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Charts_Datasets_DatasetId",
                table: "Charts",
                column: "DatasetId",
                principalTable: "Datasets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Charts_Datasets_DatasetId",
                table: "Charts");

            migrationBuilder.DropTable(
                name: "Datasets");

            migrationBuilder.DropIndex(
                name: "IX_Charts_DatasetId",
                table: "Charts");

            migrationBuilder.DropColumn(
                name: "DatasetId",
                table: "Charts");

            migrationBuilder.RenameColumn(
                name: "StyleJson",
                table: "Charts",
                newName: "Dataset");

            migrationBuilder.RenameColumn(
                name: "ConfigJson",
                table: "Charts",
                newName: "Configuration");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Charts",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "ChartType",
                table: "Charts",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(80)",
                oldMaxLength: 80);
        }
    }
}
