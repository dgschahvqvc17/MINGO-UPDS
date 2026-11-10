-- Creación de tabla materias para HU03: Gestionar materias académicas
-- Fecha: 2024-01-01
-- Autor: Sistema MINGO

-- Tabla materias
CREATE TABLE IF NOT EXISTS public.materias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    docente VARCHAR(100) NOT NULL,
    descripcion TEXT,
    periodo_academico VARCHAR(10) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6', -- Código hexadecimal
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'archivado')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE,
    
    -- Restricción de unicidad: mismo código no puede repetirse para el mismo usuario
    UNIQUE(usuario_id, codigo)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_materias_usuario_id ON public.materias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_materias_periodo_academico ON public.materias(periodo_academico);
CREATE INDEX IF NOT EXISTS idx_materias_estado ON public.materias(estado);
CREATE INDEX IF NOT EXISTS idx_materias_nombre ON public.materias USING gin(nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materias_codigo ON public.materias(codigo);

-- Comentarios de la tabla y columnas
COMMENT ON TABLE public.materias IS 'Tabla de materias académicas de los estudiantes';
COMMENT ON COLUMN public.materias.id IS 'Identificador único de la materia';
COMMENT ON COLUMN public.materias.usuario_id IS 'ID del usuario (estudiante) dueño de la materia';
COMMENT ON COLUMN public.materias.nombre IS 'Nombre de la materia académica';
COMMENT ON COLUMN public.materias.codigo IS 'Código único de la asignatura (por ejemplo: MAT101)';
COMMENT ON COLUMN public.materias.docente IS 'Nombre del docente responsable';
COMMENT ON COLUMN public.materias.descripcion IS 'Descripción opcional de la materia';
COMMENT ON COLUMN public.materias.periodo_academico IS 'Periodo académico en formato AÑO-SEMESTRE (ej: 2024-1)';
COMMENT ON COLUMN public.materias.color IS 'Color identificador en formato hexadecimal (ej: #3B82F6)';
COMMENT ON COLUMN public.materias.estado IS 'Estado de la materia: activo o archivado';
COMMENT ON COLUMN public.materias.fecha_creacion IS 'Fecha de creación del registro';
COMMENT ON COLUMN public.materias.fecha_actualizacion IS 'Fecha de última actualización';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad RLS
-- Política 1: Usuarios pueden ver solo sus propias materias
CREATE POLICY IF NOT EXISTS "Usuarios pueden ver sus propias materias" ON public.materias
    FOR SELECT USING (auth.uid() = usuario_id);

-- Política 2: Usuarios pueden crear materias solo para sí mismos
CREATE POLICY IF NOT EXISTS "Usuarios pueden crear sus propias materias" ON public.materias
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Política 3: Usuarios pueden actualizar solo sus propias materias
CREATE POLICY IF NOT EXISTS "Usuarios pueden actualizar sus propias materias" ON public.materias
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Política 4: Usuarios pueden eliminar solo sus propias materias
CREATE POLICY IF NOT EXISTS "Usuarios pueden eliminar sus propias materias" ON public.materias
    FOR DELETE USING (auth.uid() = usuario_id);

-- Trigger para actualizar fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_fecha_modificacion
    BEFORE UPDATE ON public.materias
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- Función para obtener estadísticas de materias
CREATE OR REPLACE FUNCTION obtener_estadisticas_materias(p_usuario_id UUID)
RETURNS TABLE (
    total INTEGER,
    activas INTEGER,
    archivadas INTEGER,
    por_periodo JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE estado = 'activo')::INTEGER as activas,
        COUNT(*) FILTER (WHERE estado = 'archivado')::INTEGER as archivadas,
        COALESCE(
            JSONB_OBJECT_AGG(
                periodo_academico,
                COUNT(*)::INTEGER
            ) FILTER (WHERE periodo_academico IS NOT NULL),
            '{}'::JSONB
        ) as por_periodo
    FROM public.materias
    WHERE usuario_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar formato de periodo académico
CREATE OR REPLACE FUNCTION validar_periodo_academico(periodo VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN periodo ~ '^\d{4}-[12]$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para validar formato de periodo académico
CREATE OR REPLACE FUNCTION validar_periodo_academico_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT validar_periodo_academico(NEW.periodo_academico) THEN
        RAISE EXCEPTION 'El periodo académico debe tener el formato: AÑO-SEMESTRE (ej: 2024-1)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_periodo_academico
    BEFORE INSERT OR UPDATE ON public.materias
    FOR EACH ROW
    EXECUTE FUNCTION validar_periodo_academico_trigger();

-- Función para generar el siguiente periodo académico
CREATE OR REPLACE FUNCTION generar_periodo_siguiente(periodo_actual VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    anio INTEGER;
    semestre INTEGER;
BEGIN
    IF NOT validar_periodo_academico(periodo_actual) THEN
        RAISE EXCEPTION 'Periodo académico inválido: %', periodo_actual;
    END IF;
    
    anio := CAST(SPLIT_PART(periodo_actual, '-', 1) AS INTEGER);
    semestre := CAST(SPLIT_PART(periodo_actual, '-', 2) AS INTEGER);
    
    IF semestre = 1 THEN
        RETURN anio || '-2';
    ELSE
        RETURN (anio + 1) || '-1';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Inserción de datos de ejemplo (opcional, solo para desarrollo)
INSERT INTO public.materias (usuario_id, nombre, codigo, docente, descripcion, periodo_academico, color) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Matemáticas Discretas', 'MAT101', 'Dr. Juan Pérez', 'Fundamentos de lógica matemática y teoría de conjuntos', '2024-1', '#3B82F6'),
    ('00000000-0000-0000-0000-000000000001', 'Algoritmos y Estructuras de Datos', 'INF201', 'Dra. María Gómez', 'Diseño y análisis de algoritmos eficientes', '2024-1', '#10B981'),
    ('00000000-0000-0000-0000-000000000001', 'Bases de Datos', 'INF301', 'Ing. Carlos López', 'Diseño e implementación de sistemas de bases de datos', '2024-2', '#F59E0B'),
    ('00000000-0000-0000-0000-000000000002', 'Ingeniería de Software', 'INF401', 'MSc. Ana Rodríguez', 'Metodologías de desarrollo de software', '2024-1', '#8B5CF6')
ON CONFLICT (usuario_id, codigo) DO NOTHING;