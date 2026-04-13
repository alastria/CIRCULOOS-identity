# MetaMask Snap como custodia de credenciales verificables
## Ventajas técnicas en el contexto de CIRCULOOS Identity
1. Almacenamiento cifrado sin servidor adicional
El Snap utiliza snap_manageState para persistir los StoredVC en el estado cifrado gestionado por el propio MetaMask. Esto elimina la necesidad de una base de datos de credenciales en el lado del cliente, un backend de sincronización o cualquier forma de almacenamiento en el navegador expuesto (localStorage, IndexedDB) que sería vulnerable a ataques XSS.

2. Confirmación de usuario garantizada por el runtime
Cada operación sensible — save_vc, create_vp, delete_vc — invoca snap_dialog con tipo confirmation. Esto transfiere la responsabilidad del consentimiento al entorno de ejecución aislado de MetaMask, que opera en un contexto de seguridad diferente al de la página web. La DApp no puede almacenar ni presentar credenciales sin una confirmación explícita nativa; no hay forma de bypass programático desde JavaScript de la página.

3. Separación de responsabilidades en la creación de VP
El método create_vp sigue un diseño deliberado: el Snap selecciona y ensambla las VCs del estado cifrado, pero no firma. La firma de la Verifiable Presentation se delega a MetaMask mediante el mecanismo estándar de firma EIP-712. Esto evita que el Snap tenga acceso directo a claves privadas, respetando el modelo de seguridad de MetaMask donde la clave raíz BIP-44 nunca sale del keyring.

4. Aislamiento de origen (origin isolation)
El handler onRpcRequest recibe el campo origin de cada llamada. La arquitectura permite implementar control de acceso basado en dominio: únicamente localhost:3000 (o el dominio de producción registrado) puede invocar los métodos del Snap. Cualquier otro sitio que intente llamar a wallet_invokeSnap con el ID de CIRCULOOS será rechazado, protegiendo las VCs del usuario frente a sitios maliciosos.

5. Portabilidad y ausencia de lock-in
Las credenciales se almacenan en formato W3C VC estándar dentro del estado del Snap. El método export_vcs permite al usuario extraer todas sus VCs en cualquier momento. La wallet es del usuario; las credenciales también. No existe ningún endpoint de API privado que sea la única fuente de verdad para las credenciales del holder.

6. Categorización y metadatos sin exponer la VC
El tipo StoredVC añade campos category, tags, favorite y lastUsed como metadatos locales que el Snap mantiene junto a la VC sin modificar el documento VC firmado. Esto permite UI enriquecida sin invalidar la firma criptográfica del emisor.