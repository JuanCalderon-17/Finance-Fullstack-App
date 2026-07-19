import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";

export  const jwtInterceptor: HttpInterceptorFn = ( req, next ) => {
    const router = inject(Router);

    // 1. Buscamos el usuario en el localStorage
    const userJson = localStorage.getItem('user');
    let tokenAttached = false;

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
            tokenAttached = true;
        }
    }

    // 3. Si el backend rechaza NUESTRO token (expirado/inválido), cerramos sesión.
    //    Solo cuando adjuntamos token: el 401 de un login fallido no debe redirigir.
    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401 && tokenAttached) {
                localStorage.removeItem('user');
                router.navigate(['/auth/login']);
            }
            return throwError(() => err);
        })
    );
}
