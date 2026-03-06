using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceManager.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_AppUserId",
                table: "Transactions");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AppUserId_Category",
                table: "Transactions",
                columns: new[] { "AppUserId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AppUserId_Date",
                table: "Transactions",
                columns: new[] { "AppUserId", "TransactionDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_AppUserId_Category",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_AppUserId_Date",
                table: "Transactions");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AppUserId",
                table: "Transactions",
                column: "AppUserId");
        }
    }
}
