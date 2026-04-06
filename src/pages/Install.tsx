 import { useState, useEffect } from 'react';
 import { ArrowLeft, Download, Share, Smartphone, Check, X } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { useNavigate } from 'react-router-dom';
 
 interface BeforeInstallPromptEvent extends Event {
   prompt: () => Promise<void>;
   userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
 }
 
 const Install = () => {
   const navigate = useNavigate();
   const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
   const [isInstalled, setIsInstalled] = useState(false);
   const [isIOS, setIsIOS] = useState(false);
   const [isStandalone, setIsStandalone] = useState(false);
 
   useEffect(() => {
     // Check if already installed
     const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
     setIsStandalone(checkStandalone);
 
     // Detect iOS
     const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
     setIsIOS(isIOSDevice);
 
     // Listen for install prompt
     const handleBeforeInstallPrompt = (e: Event) => {
       e.preventDefault();
       setDeferredPrompt(e as BeforeInstallPromptEvent);
     };
 
     const handleAppInstalled = () => {
       setIsInstalled(true);
       setDeferredPrompt(null);
     };
 
     window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
     window.addEventListener('appinstalled', handleAppInstalled);
 
     return () => {
       window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
       window.removeEventListener('appinstalled', handleAppInstalled);
     };
   }, []);
 
   const handleInstall = async () => {
     if (!deferredPrompt) return;
 
     await deferredPrompt.prompt();
     const { outcome } = await deferredPrompt.userChoice;
 
     if (outcome === 'accepted') {
       setIsInstalled(true);
     }
     setDeferredPrompt(null);
   };
 
   if (isStandalone || isInstalled) {
     return (
       <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
         <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
           <Check className="w-10 h-10 text-primary" />
         </div>
         <h1 className="text-2xl font-bold text-foreground mb-2">App instalado!</h1>
         <p className="text-muted-foreground mb-6">
           O Kura já está instalado no seu dispositivo.
         </p>
         <Button onClick={() => navigate('/')} className="btn-primary">
           Voltar para o app
         </Button>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background">
       {/* Header */}
       <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
         <div className="flex items-center justify-between px-4 py-3">
           <Button
             variant="ghost"
             size="icon"
             onClick={() => navigate(-1)}
             className="text-foreground"
           >
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <h1 className="text-lg font-semibold">Instalar App</h1>
           <div className="w-10" />
         </div>
       </header>
 
       <div className="p-6 max-w-md mx-auto">
         {/* App icon */}
         <div className="flex justify-center mb-8">
           <div className="w-24 h-24 rounded-2xl bg-card shadow-lg flex items-center justify-center">
             <img 
               src="/pwa-192x192.png" 
               alt="Kura" 
               className="w-20 h-20 rounded-xl"
             />
           </div>
         </div>
 
         <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            Instale a Kura
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Acesse a Kura direto da sua tela inicial, com carregamento rápido e experiência de app nativo.
          </p>
 
         {/* Features */}
         <div className="space-y-4 mb-8">
           <div className="flex items-center gap-4 p-4 bg-card rounded-xl">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
               <Smartphone className="w-5 h-5 text-primary" />
             </div>
             <div>
               <p className="font-medium text-foreground">Acesso rápido</p>
               <p className="text-sm text-muted-foreground">Abra direto da tela inicial</p>
             </div>
           </div>
 
           <div className="flex items-center gap-4 p-4 bg-card rounded-xl">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
               <Download className="w-5 h-5 text-primary" />
             </div>
             <div>
               <p className="font-medium text-foreground">Funciona offline</p>
               <p className="text-sm text-muted-foreground">Navegue mesmo sem internet</p>
             </div>
           </div>
         </div>
 
         {/* Install instructions */}
         {isIOS ? (
           <div className="bg-card rounded-xl p-6 mb-6">
             <h3 className="font-semibold text-foreground mb-4">Como instalar no iPhone/iPad:</h3>
             <ol className="space-y-3 text-sm text-muted-foreground">
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                 <span>Toque no botão <Share className="w-4 h-4 inline text-primary" /> Compartilhar na barra do Safari</span>
               </li>
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                 <span>Role para baixo e toque em "Adicionar à Tela de Início"</span>
               </li>
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                 <span>Toque em "Adicionar" para confirmar</span>
               </li>
             </ol>
           </div>
         ) : deferredPrompt ? (
           <Button 
             onClick={handleInstall} 
             className="w-full btn-primary h-12 text-base"
           >
             <Download className="w-5 h-5 mr-2" />
             Instalar agora
           </Button>
         ) : (
           <div className="bg-card rounded-xl p-6 mb-6">
             <h3 className="font-semibold text-foreground mb-4">Como instalar:</h3>
             <ol className="space-y-3 text-sm text-muted-foreground">
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                 <span>Abra o menu do navegador (três pontos)</span>
               </li>
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                 <span>Toque em "Instalar app" ou "Adicionar à tela inicial"</span>
               </li>
               <li className="flex items-start gap-3">
                 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                 <span>Confirme a instalação</span>
               </li>
             </ol>
           </div>
         )}
       </div>
     </div>
   );
 };
 
 export default Install;