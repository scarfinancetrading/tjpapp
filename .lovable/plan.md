# Crear cuenta admin

Con `auto_confirm_email` activo y el email admin (`investingforfuture09121110@gmail.com`) hardcodeado en `useAuth` / `AdminPanel` / `is_admin()`, basta con que ese email exista en `auth.users` con una contraseña conocida. El acceso admin no depende de `profiles.status` — `hasAccess = isAdmin || active`.

## Pasos

1. **Tú abres `/auth`** en el preview, pestaña "Registrarse".
2. Ingresas:
   - Email: `investingforfuture09121110@gmail.com`
   - Contraseña: la que quieras usar (mín. 6 caracteres)
3. El signup te loguea al instante (sin email de confirmación) y como el email coincide con `ADMIN_EMAIL`, `isAdmin = true` → entras a `/app` con acceso completo y verás la tarjeta "Admin Panel".

## Si el signup falla con "User already registered"

Significa que la cuenta existe pero la contraseña anterior se perdió en el remix. En ese caso implementaré la ruta B:

- Crear edge function `admin-reset-password` (service role, sin JWT) protegida por un secreto `ADMIN_RESET_TOKEN` de un solo uso.
- La función solo permite resetear la contraseña del email admin.
- Tú la llamas una vez con el token vía `curl`/consola, defines nueva contraseña, y luego borro la función.

## Notas técnicas

- No hace falta tocar `profiles` — el trigger `handle_new_user` lo crea automáticamente y el bypass admin ignora el status.
- No cambio nada en frontend ni backend en el paso 1; solo si aparece el error de "ya registrado" pasamos al paso B.

Dime cuando lo intentes y te confirmo si necesitamos la ruta B.
