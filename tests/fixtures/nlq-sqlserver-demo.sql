IF DB_ID(N'JIAWorkNLQDemo') IS NULL CREATE DATABASE [JIAWorkNLQDemo];
GO
USE [JIAWorkNLQDemo];
GO

IF OBJECT_ID(N'dbo.SalesOrderLine', N'U') IS NULL
CREATE TABLE dbo.SalesOrderLine (
  order_no varchar(30) NOT NULL,
  line_no int NOT NULL,
  customer_name nvarchar(100) NOT NULL,
  part_no varchar(50) NOT NULL,
  order_date date NOT NULL,
  quantity decimal(18, 2) NOT NULL,
  CONSTRAINT PK_NLQ_SalesOrderLine PRIMARY KEY (order_no, line_no)
);
GO
IF OBJECT_ID(N'dbo.PurchaseOrderLine', N'U') IS NULL
CREATE TABLE dbo.PurchaseOrderLine (
  po_no varchar(30) NOT NULL,
  line_no int NOT NULL,
  supplier_name nvarchar(100) NOT NULL,
  part_no varchar(50) NOT NULL,
  order_date date NOT NULL,
  promised_date date NOT NULL,
  ordered_quantity decimal(18, 2) NOT NULL,
  received_quantity decimal(18, 2) NOT NULL,
  CONSTRAINT PK_NLQ_PurchaseOrderLine PRIMARY KEY (po_no, line_no)
);
GO
IF OBJECT_ID(N'dbo.InventorySnapshot', N'U') IS NULL
CREATE TABLE dbo.InventorySnapshot (
  snapshot_date date NOT NULL,
  warehouse_name nvarchar(100) NOT NULL,
  part_no varchar(50) NOT NULL,
  quantity decimal(18, 2) NOT NULL,
  CONSTRAINT PK_NLQ_InventorySnapshot PRIMARY KEY (snapshot_date, warehouse_name, part_no)
);
GO
IF OBJECT_ID(N'dbo.CustomerMaster', N'U') IS NULL
CREATE TABLE dbo.CustomerMaster (
  customer_name nvarchar(100) NOT NULL PRIMARY KEY,
  region_name nvarchar(100) NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.CustomerMaster)
INSERT INTO dbo.CustomerMaster VALUES
  (N'客户甲', N'华东'),
  (N'客户乙', N'华南');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SalesOrderLine)
INSERT INTO dbo.SalesOrderLine VALUES
  ('SO-2025-001', 1, N'客户甲', 'JD-001', '2025-10-05', 150),
  ('SO-2026-009', 1, N'客户甲', 'JD-001', '2026-09-05', 120),
  ('SO-2026-010', 1, N'客户甲', 'JD-001', '2026-10-01', 100),
  ('SO-2026-011', 1, N'客户甲', 'JD-001', '2026-10-15', 80),
  ('SO-2026-012', 1, N'客户乙', 'JD-002', '2026-10-20', 50);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrderLine)
INSERT INTO dbo.PurchaseOrderLine VALUES
  ('PO-2026-009', 1, N'供应商甲', 'JD-001', '2026-09-05', '2026-09-20', 200, 200),
  ('PO-2026-010', 1, N'供应商甲', 'JD-001', '2026-10-02', '2026-10-20', 300, 200),
  ('PO-2026-011', 1, N'供应商甲', 'JD-002', '2026-10-12', '2026-10-31', 100, 50),
  ('PO-2026-012', 1, N'供应商乙', 'JD-001', '2026-10-16', '2026-11-02', 80, 80);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.InventorySnapshot)
INSERT INTO dbo.InventorySnapshot VALUES
  ('2026-09-30', N'原料仓', 'JD-001', 95),
  ('2026-09-30', N'成品仓', 'JD-001', 60),
  ('2026-10-31', N'原料仓', 'JD-001', 120),
  ('2026-10-31', N'成品仓', 'JD-001', 70),
  ('2026-10-31', N'原料仓', 'JD-002', 40);
GO
