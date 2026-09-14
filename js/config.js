'use strict';
const SUPABASE_URL = 'https://jsrarddyrjmuinwlyten.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcmFyZGR5cmptdWlud2x5dGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjIxNDQsImV4cCI6MjEwNDI5ODE0NH0.4BBl7Cu0mJFL014dbWGN49AYJVZLxeYbWnegn9-S41M';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ROLE_LABELS = { user:'Usuario', restaurant:'Restaurante', delivery:'Domiciliario', nightclub:'Discoteca', remote_worker:'Trabajador Remoto', admin:'Administrador' };
const STATUS_LABELS = { single:'Soltero/a', married:'Casado/a', looking:'Buscando conocer', unavailable:'No disponible' };
const ORDER_LABELS = { pending:'Pendiente', preparing:'Preparando', ready:'Listo', delivering:'En camino', delivered:'Entregado', cancelled:'Cancelado' };
