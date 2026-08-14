# Script téléphonique — répondeur / IVR Kami Street

Pour le cas où personne ne décroche l'appel (renvoi automatique vers un
message vocal ou vers un agent voix Limova). À adapter en fonction de ce que
Limova propose : simple message vocal statique, ou agent voix conversationnel.

## Option A — Message vocal simple (répondeur, pas d'IA en voix)

À faire lire par la synthèse vocale ou enregistrer avec une vraie voix :

```
Bonjour, vous êtes bien chez Kami Street.
Nous ne sommes pas disponibles pour le moment.
Pour être rappelé rapidement, envoyez-nous un message sur WhatsApp au
[numéro WhatsApp Kami Street] : indiquez votre nom, le produit qui vous
intéresse, et un créneau pour vous joindre.
Vous pouvez aussi laisser un message après le bip, nous vous répondrons
dans les meilleurs délais.
Merci et à bientôt chez Kami Street.
```

Notes :
- Remplacer [numéro WhatsApp Kami Street] par le vrai numéro.
- Garder des phrases courtes, une pause après chaque phrase pour la synthèse vocale.
- Éviter les chiffres énoncés trop vite : détacher le numéro de téléphone/WhatsApp (ex. "zéro sept... douze... trente-quatre...").

## Option B — Agent voix conversationnel (si Limova gère un agent IA vocal)

Message d'ouverture (identique en esprit au message d'accueil WhatsApp, mais
adapté à l'oral : pas d'emoji, phrases courtes, une seule question à la fois) :

```
Bonjour, bienvenue chez Kami Street.
Nous n'avons pas pu décrocher tout de suite, mais je peux vous aider dès
maintenant.
Souhaitez-vous des informations sur un produit, passer une commande,
ou préférez-vous qu'un conseiller vous rappelle ?
```

Comportement ensuite : reprendre exactement la même logique que le prompt
système WhatsApp (`prompt-systeme.md`) — questions produits à partir du
catalogue, commande en quantité, bascule vers collecte de coordonnées pour
rappel au-delà du seuil ou en cas de réclamation.

Adaptations spécifiques à l'oral :
- Une seule information demandée à la fois (pas de liste énumérée comme à l'écrit).
  Ex : d'abord "Quel est votre nom ?", puis "Et un numéro pour vous rappeler ?", etc.
- Faire répéter/confirmer le numéro de téléphone donné à l'oral avant de le
  valider ("Donc je note le zéro sept, douze, trente-quatre... c'est bien ça ?").
- Pas de tag technique [[CALLBACK: ...]] lu à voix haute : c'est une donnée
  interne, à générer uniquement dans les logs/transcript de l'appel pour
  déclencher la création du lead, jamais prononcée au client.
- Clôture orale :
  ```
  Merci [nom], c'est noté. Un conseiller Kami Street va vous rappeler
  rapidement. Bonne journée et à bientôt chez Kami Street.
  ```

## Option C — SMS de secours après appel manqué (complément, si Limova le permet)

Si un agent voix n'est pas disponible tout de suite, un SMS automatique peut
être envoyé juste après l'appel manqué pour rediriger vers WhatsApp :

```
Kami Street : désolé de vous avoir manqué. Écrivez-nous sur WhatsApp au
[numéro] pour être rappelé rapidement, ou rappelez-nous directement.
```
