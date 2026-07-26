using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceManager.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSavingsAccountCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts");

            migrationBuilder.AddForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts",
                column: "AppUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts");

            migrationBuilder.AddForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts",
                column: "AppUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }
    }
}
