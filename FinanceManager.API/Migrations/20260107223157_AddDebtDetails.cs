using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceManager.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDebtDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Installments",
                table: "Debts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "InterestRate",
                table: "Debts",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "PaidInstallments",
                table: "Debts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Debts_AppUserId",
                table: "Debts",
                column: "AppUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Debts_AspNetUsers_AppUserId",
                table: "Debts",
                column: "AppUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Debts_AspNetUsers_AppUserId",
                table: "Debts");

            migrationBuilder.DropIndex(
                name: "IX_Debts_AppUserId",
                table: "Debts");

            migrationBuilder.DropColumn(
                name: "Installments",
                table: "Debts");

            migrationBuilder.DropColumn(
                name: "InterestRate",
                table: "Debts");

            migrationBuilder.DropColumn(
                name: "PaidInstallments",
                table: "Debts");
        }
    }
}
