using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceManager.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDebtsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "AppUserId",
                table: "SavingsAccounts",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts",
                column: "AppUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "AppUserId",
                table: "SavingsAccounts",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingsAccounts_AspNetUsers_AppUserId",
                table: "SavingsAccounts",
                column: "AppUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
