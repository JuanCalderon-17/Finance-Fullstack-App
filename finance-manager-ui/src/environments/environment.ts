// Configuración por defecto = PRODUCCIÓN.
// `ng build` (y el deploy de Vercel) usan este archivo tal cual.
// Para desarrollo local, `ng serve` lo reemplaza automáticamente por
// `environment.development.ts` (ver `fileReplacements` en angular.json),
// así nunca hay que editar la URL a mano.
export const environment = {
    production: true,
    apiUrl: 'https://api.finanzasbr.com/api/'
};
