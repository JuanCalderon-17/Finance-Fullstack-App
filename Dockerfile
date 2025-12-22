# 1. IMAGEN DE CONSTRUCCIÓN (SDK)
# Usamos el "kit de herramientas" de .NET 9 para compilar
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copiamos solo el archivo de proyecto primero (para aprovechar la caché)
COPY ["FinanceManager.API/FinanceManager.API.csproj", "FinanceManager.API/"]
RUN dotnet restore "FinanceManager.API/FinanceManager.API.csproj"

# Copiamos todo el código restante
COPY . .
WORKDIR "/src/FinanceManager.API"

# Compilamos y publicamos la versión final optimizada
RUN dotnet build "FinanceManager.API.csproj" -c Release -o /app/build
FROM build AS publish
RUN dotnet publish "FinanceManager.API.csproj" -c Release -o /app/publish

# 2. IMAGEN DE EJECUCIÓN (Runtime)
# Usamos una imagen ligera solo para correr la app (más segura)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Configuramos el puerto 8080 (estándar en contenedores)
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "FinanceManager.API.dll"]