IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] uniqueidentifier NOT NULL,
        [Email] nvarchar(450) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [FullName] nvarchar(max) NOT NULL,
        [Role] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE TABLE [Projects] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Projects] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Projects_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE TABLE [Charts] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [ChartType] nvarchar(max) NOT NULL,
        [Configuration] nvarchar(max) NOT NULL,
        [Dataset] nvarchar(max) NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Charts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Charts_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE TABLE [ProjectMembers] (
        [Id] uniqueidentifier NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Role] int NOT NULL,
        [AssignedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ProjectMembers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProjectMembers_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ProjectMembers_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE INDEX [IX_Charts_ProjectId] ON [Charts] ([ProjectId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProjectMembers_ProjectId_UserId] ON [ProjectMembers] ([ProjectId], [UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE INDEX [IX_ProjectMembers_UserId] ON [ProjectMembers] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE INDEX [IX_Projects_UserId] ON [Projects] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303205856_AddProjectMemberEntity'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260303205856_AddProjectMemberEntity', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    ALTER TABLE [Charts] ADD [Status] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [ActionType] nvarchar(100) NOT NULL,
        [EntityType] nvarchar(100) NOT NULL,
        [EntityId] uniqueidentifier NOT NULL,
        [Timestamp] datetime2 NOT NULL,
        [OldValue] nvarchar(max) NULL,
        [NewValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AuditLogs_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_EntityType_EntityId] ON [AuditLogs] ([EntityType], [EntityId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_Timestamp] ON [AuditLogs] ([Timestamp]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_UserId] ON [AuditLogs] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303213633_AddAuditLogEntity'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260303213633_AddAuditLogEntity', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303215126_AddReportEntity'
)
BEGIN
    CREATE TABLE [Reports] (
        [Id] uniqueidentifier NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [MetadataJson] nvarchar(max) NOT NULL,
        [LayoutJson] nvarchar(max) NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Reports] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Reports_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303215126_AddReportEntity'
)
BEGIN
    CREATE INDEX [IX_Reports_ProjectId] ON [Reports] ([ProjectId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303215126_AddReportEntity'
)
BEGIN
    CREATE INDEX [IX_Reports_UpdatedAt] ON [Reports] ([UpdatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260303215126_AddReportEntity'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260303215126_AddReportEntity', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    ALTER TABLE [Reports] ADD [Name] nvarchar(200) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    ALTER TABLE [Reports] ADD [UserId] nvarchar(450) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE TABLE [Dashboards] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Dashboards] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Dashboards_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE TABLE [ReportCharts] (
        [Id] uniqueidentifier NOT NULL,
        [ReportId] uniqueidentifier NOT NULL,
        [ChartId] uniqueidentifier NOT NULL,
        [OrderIndex] int NOT NULL,
        CONSTRAINT [PK_ReportCharts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ReportCharts_Charts_ChartId] FOREIGN KEY ([ChartId]) REFERENCES [Charts] ([Id]),
        CONSTRAINT [FK_ReportCharts_Reports_ReportId] FOREIGN KEY ([ReportId]) REFERENCES [Reports] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE TABLE [DashboardCharts] (
        [Id] uniqueidentifier NOT NULL,
        [DashboardId] uniqueidentifier NOT NULL,
        [ChartId] uniqueidentifier NOT NULL,
        [PositionX] int NOT NULL,
        [PositionY] int NOT NULL,
        [Width] int NOT NULL,
        [Height] int NOT NULL,
        CONSTRAINT [PK_DashboardCharts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DashboardCharts_Charts_ChartId] FOREIGN KEY ([ChartId]) REFERENCES [Charts] ([Id]),
        CONSTRAINT [FK_DashboardCharts_Dashboards_DashboardId] FOREIGN KEY ([DashboardId]) REFERENCES [Dashboards] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_DashboardCharts_ChartId] ON [DashboardCharts] ([ChartId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_DashboardCharts_DashboardId] ON [DashboardCharts] ([DashboardId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DashboardCharts_DashboardId_ChartId] ON [DashboardCharts] ([DashboardId], [ChartId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_Dashboards_ProjectId] ON [Dashboards] ([ProjectId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_Dashboards_UpdatedAt] ON [Dashboards] ([UpdatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_ReportCharts_ChartId] ON [ReportCharts] ([ChartId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE INDEX [IX_ReportCharts_ReportId] ON [ReportCharts] ([ReportId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ReportCharts_ReportId_ChartId] ON [ReportCharts] ([ReportId], [ChartId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ReportCharts_ReportId_OrderIndex] ON [ReportCharts] ([ReportId], [OrderIndex]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311081754_AddDashboardsAndReports'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260311081754_AddDashboardsAndReports', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    EXEC sp_rename N'[Charts].[Dataset]', N'StyleJson', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    EXEC sp_rename N'[Charts].[Configuration]', N'ConfigJson', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Charts]') AND [c].[name] = N'Name');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Charts] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [Charts] ALTER COLUMN [Name] nvarchar(200) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Charts]') AND [c].[name] = N'ChartType');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Charts] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [Charts] ALTER COLUMN [ChartType] nvarchar(80) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    ALTER TABLE [Charts] ADD [DatasetId] uniqueidentifier NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    CREATE TABLE [Datasets] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Description] nvarchar(2000) NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [DataJson] nvarchar(max) NOT NULL,
        [SourceType] nvarchar(50) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Datasets] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Datasets_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN

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

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Charts]') AND [c].[name] = N'DatasetId');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Charts] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [Charts] ALTER COLUMN [DatasetId] uniqueidentifier NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    CREATE INDEX [IX_Charts_DatasetId] ON [Charts] ([DatasetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    CREATE INDEX [IX_Datasets_ProjectId] ON [Datasets] ([ProjectId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    CREATE INDEX [IX_Datasets_UserId] ON [Datasets] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    ALTER TABLE [Charts] ADD CONSTRAINT [FK_Charts_Datasets_DatasetId] FOREIGN KEY ([DatasetId]) REFERENCES [Datasets] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260311125115_AddDatasetLibrary'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260311125115_AddDatasetLibrary', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260312073319_RemoveDatasetAspNetUserForeignKey'
)
BEGIN

    IF EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Datasets_AspNetUsers_UserId'
    )
    BEGIN
        ALTER TABLE [Datasets] DROP CONSTRAINT [FK_Datasets_AspNetUsers_UserId];
    END;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260312073319_RemoveDatasetAspNetUserForeignKey'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260312073319_RemoveDatasetAspNetUserForeignKey', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260315134149_AddReportChartLayout'
)
BEGIN
    ALTER TABLE [ReportCharts] ADD [Height] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260315134149_AddReportChartLayout'
)
BEGIN
    ALTER TABLE [ReportCharts] ADD [PositionX] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260315134149_AddReportChartLayout'
)
BEGIN
    ALTER TABLE [ReportCharts] ADD [PositionY] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260315134149_AddReportChartLayout'
)
BEGIN
    ALTER TABLE [ReportCharts] ADD [Width] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260315134149_AddReportChartLayout'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260315134149_AddReportChartLayout', N'10.0.0');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260319111720_AddDashboardStudioStateJson'
)
BEGIN
    ALTER TABLE [Dashboards] ADD [ComponentsJson] nvarchar(max) NOT NULL DEFAULT N'[]';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260319111720_AddDashboardStudioStateJson'
)
BEGIN
    ALTER TABLE [Dashboards] ADD [LayoutJson] nvarchar(max) NOT NULL DEFAULT N'{}';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260319111720_AddDashboardStudioStateJson'
)
BEGIN
    ALTER TABLE [Dashboards] ADD [PageStructureJson] nvarchar(max) NOT NULL DEFAULT N'[]';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260319111720_AddDashboardStudioStateJson'
)
BEGIN
    ALTER TABLE [Dashboards] ADD [SnapshotJson] nvarchar(max) NOT NULL DEFAULT N'{}';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260319111720_AddDashboardStudioStateJson'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260319111720_AddDashboardStudioStateJson', N'10.0.0');
END;

COMMIT;
GO

