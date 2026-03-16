

# Dialog de Jornada IO no ChatSidebar

## Resumo
Substituir `navigate('/profile')` no mini card de jornada (linha 546) por abertura de um Dialog com o `IOJourneySection` embutido, mais link "Ver perfil completo" no rodapé.

## Alterações em `src/components/chat/ChatSidebar.tsx`

### 1. Imports
Adicionar: `Dialog, DialogContent, DialogHeader, DialogTitle` de `@/components/ui/dialog` e `IOJourneySection` de `@/components/profile/IOJourneySection`.

### 2. State
Adicionar `const [isJourneyOpen, setIsJourneyOpen] = useState(false)` dentro do componente.

### 3. Mini card onClick (linha 546)
Trocar `onClick={() => navigate('/profile')}` por `onClick={() => setIsJourneyOpen(true)}`.

### 4. Dialog JSX
Após o bloco do mini card (após a div que fecha na linha 569), renderizar:

```tsx
<Dialog open={isJourneyOpen} onOpenChange={setIsJourneyOpen}>
  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
    <DialogHeader className="p-6 pb-0">
      <DialogTitle>Minha Jornada IO</DialogTitle>
    </DialogHeader>
    <div className="px-2">
      <IOJourneySection userId={user!.id} />
    </div>
    <div className="p-4 pt-0">
      <button
        onClick={() => { setIsJourneyOpen(false); navigate('/profile'); }}
        className="text-xs text-muted-foreground hover:underline w-full text-center"
      >
        Ver perfil completo →
      </button>
    </div>
  </DialogContent>
</Dialog>
```

`IOJourneySection` recebe `userId: string` como prop e busca seus próprios dados internamente, portanto funciona sem alterações. Passamos `user!.id` (seguro pois o card só renderiza quando `user` existe).

## Arquivos alterados
- `src/components/chat/ChatSidebar.tsx`

