import { HttpInterceptorFn } from "@angular/common/http";

export  const jwtInterceptor: HttpInterceptorFn = ( req, next ) => {
    // 1. Buscamos el usuario en el localStorage
    const userJson = localStorage.getItem('user');

    // 2. Si existe, intentamos leer el token
    if (userJson)
    {
        const user = JSON.parse(userJson);
        if(user.token) {
            // Clonamos la petición original y le pegamos el Token en la cabecera
            req = req.clone({
                setHeaders: {
                    Authorization: `Bearer ${user.token}`
                }
            });
        }
    }
    // 4. Dejamos pasar la petición (modificada o no)
    return next(req);
}