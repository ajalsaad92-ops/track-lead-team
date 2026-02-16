

# خطة التنفيذ: صلاحيات الفرد + سجل الرقابة + مزامنة إدارة المستخدمين

---

## الجزء 1: صلاحيات الفرد لتعديل المناهج (Individual Edit Access)

### 1.1 تحديث سياسات RLS
- المشكلة الحالية: سياسة "Individuals update own curricula" تسمح فقط بتعديل المناهج التي أنشأها الفرد (`created_by = auth.uid()`).
- الحل: إضافة سياسة RLS جديدة تسمح للفرد بتعديل أي منهج في شعبته (ليتمكن من إكمال بيانات المناهج المستوردة).

```sql
CREATE POLICY "Individuals update unit curricula"
ON public.curricula FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()));
```

- ايضا حذف السياسة القديمة المحدودة:
```sql
DROP POLICY "Individuals update own curricula" ON public.curricula;
```

### 1.2 تحديث واجهة المناهج (Curricula.tsx)
- ازالة شرط `created_by === user.id` من زر التعديل ليتمكن الفرد من فتح اي سجل في شعبته وتعديل الحقول الفارغة.

---

## الجزء 2: نظام التنبيهات التلقائي للنواقص (Auto-Nudge)

### 2.1 تنبيهات لوحة القيادة
- تحديث `Dashboard.tsx`: اذا كان المستخدم "فرد"، يتم عرض كرت تنبيهات النواقص (`IncompleteCurriculaAlert`) الذي يعرض المناهج التي تحتوي على حقول فارغة في شعبته.
- هذه الميزة موجودة جزئيا بالفعل عبر مكون `IncompleteCurriculaAlert` لكنها تظهر لجميع الادوار. سيتم تحسينها لتكون اكثر وضوحا للفرد مع نص "مهمة تلقائية لإكمال بيانات".

---

## الجزء 3: سجل نشاط الشعبة لرئيس الشعبة (Section Activity Logs)

### 3.1 اضافة تبويب "سجل النشاط" في صفحة الموارد البشرية
- اضافة تبويب رابع "سجل نشاط الشعبة" في `HR.tsx` يظهر فقط لادوار `admin` و `unit_head`.
- يعرض سجلات `audit_log` المفلترة تلقائيا لعرض حركات افراد الشعبة فقط.
- يشمل: نوع الحركة، الزمان، تفاصيل التغيير.

### 3.2 سياسات RLS (موجودة بالفعل)
- سياسة "Unit heads view unit audit logs" الحالية تسمح لرئيس الشعبة بمشاهدة سجلات افراد شعبته. لا حاجة لتغيير.

---

## الجزء 4: مزامنة إدارة المستخدمين

### 4.1 تحسين جدول المستخدمين
- الميزات الحالية (تعديل البيانات، تغيير كلمة المرور، تعطيل/تفعيل) مطبقة بالفعل.
- التحسينات: اضافة عمود "البريد الالكتروني" في جدول المستخدمين (يتم تخزينه في `user_metadata` عند الانشاء).

### 4.2 تسجيل حركات التعديل في audit_log
- عند تعديل اي بيانات منهج (خاصة من قبل الفرد)، يتم تسجيل الحقول القديمة والجديدة في `audit_log` مع التفاصيل.

---

## التفاصيل التقنية

### Database Migration
```sql
-- Allow individuals to update any curriculum in their unit
DROP POLICY IF EXISTS "Individuals update own curricula" ON public.curricula;
CREATE POLICY "Individuals update unit curricula"
ON public.curricula FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'individual'::app_role) AND unit = get_user_unit(auth.uid()));
```

### الملفات التي ستُعدّل
| الملف | التغييرات |
|---|---|
| `src/pages/Curricula.tsx` | ازالة قيد `created_by` على زر التعديل للفرد، اضافة تسجيل audit_log عند تعديل المناهج |
| `src/pages/Dashboard.tsx` | تحسين عرض تنبيهات النواقص للافراد مع نص "مهمة تلقائية لإكمال بيانات" |
| `src/pages/HR.tsx` | اضافة تبويب "سجل نشاط الشعبة" مع فلترة تلقائية حسب الشعبة |

### لا ملفات جديدة مطلوبة
جميع التعديلات على ملفات موجودة بالفعل.

### لا تغيير في RLS اخر
سياسات audit_log الحالية كافية لعرض السجلات لرئيس الشعبة.

