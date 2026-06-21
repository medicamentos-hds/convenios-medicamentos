# Convenios de Medicamentos

Sitio estático (HTML/CSS/JS puro) para buscar medicamentos y registrar convenios, usando Supabase como backend.

## Estructura

- `index.html` — UI con pestañas: Buscar, Ingresar Medicamento, Ingresar Convenio Vigente, Ingresar Convenio Nuevo.
- `css/styles.css` — estilos.
- `js/config.js` — credenciales de Supabase (NO se sube al repo, está en `.gitignore`).
- `js/config.example.js` — plantilla de `config.js` para nuevos clones.
- `js/supabaseClient.js` — inicializa el cliente de Supabase.
- `js/app.js` — lógica de búsqueda, formularios y cálculos automáticos.
- `js/auth.js` — pantalla de login y control de acceso a la app.
- `sql/politicas_rls.sql` — políticas de Row Level Security para Supabase.
- `sql/agregar_columna_observaciones.sql` — agrega la columna `observaciones` a `medicamento`.
- `assets/logo-hds.jpg` — logo mostrado en el header.
- `database.txt` — esquema de referencia de las tablas en Supabase.

## Esquema de datos (Supabase)

- `medicamento` — datos del medicamento, sus consumos históricos/proyectados y `observaciones` (texto libre; requiere ejecutar `sql/agregar_columna_observaciones.sql` si la columna no existe aún).
- `convenio_act` — convenio vigente asociado a un medicamento (`id_medicamento`) y a un proveedor (`id_proveedor`, nullable).
- `convenio_nuevo` — duplicado de `convenio_act` para el convenio nuevo en evaluación.
- `proveedor` — catálogo de proveedores (`id`, `nombre_proveedor`), referenciado por `id_proveedor` en ambas tablas de convenio.
- `user` — credenciales de acceso al sitio (`user`, `password`). El nombre `user` es palabra reservada en Postgres, por lo que siempre se referencia entre comillas (`"user"`) en SQL.

## Configuración

1. Copia `js/config.example.js` como `js/config.js`.
2. Completa `url` y `anonKey` con los datos de tu proyecto Supabase (Project Settings → API).
3. Abre `index.html` en el navegador (o usa un servidor estático local, ej. `npx serve`).

## Permisos en Supabase (RLS)

Como el sitio usa la `anon key` directamente desde el navegador, debes habilitar Row Level Security en las tablas `medicamento`, `convenio_act`, `convenio_nuevo` y `proveedor`, y crear políticas que permitan las operaciones necesarias (`select` para buscar, `insert` para los formularios).

Ejecuta el script `sql/politicas_rls.sql` en el SQL Editor de Supabase para crear estas políticas (lectura e inserción pública) en las cuatro tablas.

Si el sitio es público y no quieres que cualquiera pueda insertar datos, considera restringir las políticas de `insert`/`update` (por ejemplo con Supabase Auth) antes de publicar.

## Despliegue en GitHub Pages

1. Sube el repositorio a GitHub (asegúrate de que `js/config.js` con tus credenciales reales **no** se suba si el repo es público y no quieres expuesta tu URL/key — aunque la anon key está diseñada para ser pública si RLS está bien configurado).
2. En el repo de GitHub: Settings → Pages → Build and deployment → Source: "Deploy from a branch", elige `main` y carpeta `/ (root)`.
3. Si no quieres versionar `config.js`, puedes generarlo en un paso de GitHub Actions a partir de secrets del repositorio, o subirlo manualmente sabiendo que la anon key es pública por diseño.
4. Accede a la URL que entrega GitHub Pages (`https://<usuario>.github.io/<repo>/`).

## Login

- Al abrir el sitio se muestra una pantalla de login antes de cargar la app.
- Las credenciales se verifican contra la tabla `user` (columnas `user` y `password`), comparando el valor ingresado tal cual (sin hash).
- Si la combinación existe, se guarda el usuario en `sessionStorage` (se pierde al cerrar la pestaña) y se muestra la app. El botón "Cerrar sesión" del header borra esa sesión y vuelve al login.
- **Importante:** dado que la política RLS de `user` permite `select` público (necesario para validar el login desde el navegador con la `anon key`), cualquiera que conozca la URL de Supabase puede leer la tabla completa de usuarios/contraseñas directamente vía API. Esto es un esquema de acceso básico para limitar el uso casual del sitio, **no** una autenticación segura. Si necesitas protección real, migra a Supabase Auth (con contraseñas hasheadas y políticas que solo permitan leer el propio usuario autenticado).

## Buscador

- Permite texto (nombre, coincidencia parcial) o número (código exacto o nombre parcial).
- Incluye un segundo filtro por "ID convenio", que busca coincidencias parciales tanto en `convenio_act` (vigente) como en `convenio_nuevo`, y restringe los resultados a los medicamentos asociados a esos convenios. Ambos filtros (texto y convenio) se pueden combinar.
- Cada resultado muestra los datos del medicamento, un cuadro de análisis comparativo (variación % de consumo entre años), los convenios vigente/nuevo asociados (con el nombre del proveedor) y las observaciones del medicamento.
- Todos los valores numéricos (excepto años y código de medicamento) se muestran con separador de miles (`##.###.###`).
- Cuando hay resultados, aparece el botón "Descargar resultados en PDF" (alineado a la derecha, junto al mensaje de estado), que genera un PDF a partir de la captura visual de los resultados (usando `html2canvas` + `jsPDF`, cargados por CDN) y lo descarga automáticamente, paginando si el contenido excede una hoja A4.

## Formulario "Ingresar Medicamento"

- `fecha_actual` se completa automáticamente con la fecha de hoy.
- `anio_ant_1` y `anio_ant_2` se calculan automáticamente como año actual −1 y −2; sus etiquetas muestran el año correspondiente.
- `consumo_proy` es de solo lectura y se calcula como `(consumo_actual / mes_actual) * 12`.
- `codigo_med` solo acepta dígitos (sin puntos). Los demás campos numéricos solo aceptan dígitos y se formatean con punto de miles mientras se escribe; al guardar se convierten a número sin puntos.
- Incluye un campo de texto libre `observaciones` (textarea) que se guarda tal cual, sin formato.

## Formularios de convenio (Vigente / Nuevo)

- El proveedor se selecciona desde un listado cargado desde la tabla `proveedor`. Si no existe, se puede elegir "+ Agregar nuevo proveedor..." e ingresar el nombre manualmente; se crea en la tabla `proveedor` antes de guardar el convenio.
- `precio_total_conv` es de solo lectura y se calcula como `cantidad * precio_unit_neto * 1.19`.
- `precio_anual_conv` es de solo lectura y se calcula como `precio_total_conv / (duracion_meses / 12)`.
- `precio_unit_neto`, `precio_total_conv` y `precio_anual_conv` muestran el símbolo `$` fijo a la izquierda del campo.
- El formulario requiere seleccionar un medicamento ya existente.
