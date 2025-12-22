using FinanceManager.API.Models;


namespace FinanceManager.API.Interfaces
{
    public interface ITokenService
    {
        String CreateToken(AppUser user);
    }
}
