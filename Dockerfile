# 1. build image, use the .NET 9 SDK toolkit to compile the application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy only the project file first 
COPY ["FinanceManager.API/FinanceManager.API.csproj", "FinanceManager.API/"]
RUN dotnet restore "FinanceManager.API/FinanceManager.API.csproj"

# Copy all the remaining source code
COPY . .
WORKDIR "/src/FinanceManager.API"

# Compile and publish the optimized final version
RUN dotnet build "FinanceManager.API.csproj" -c Release -o /app/build
FROM build AS publish
RUN dotnet publish "FinanceManager.API.csproj" -c Release -o /app/publish

# 2. Runtime image, a lightweight image just to run the app (more secure)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Port configuration, 8080 is the standard port for containers 
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "FinanceManager.API.dll"]