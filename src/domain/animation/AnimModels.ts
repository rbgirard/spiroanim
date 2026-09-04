import {
  SphereGeometry,
  /*TorusGeometry,*/ CylinderGeometry,
  LatheGeometry,
  SplineCurve,
  TorusGeometry,
  Vector2,
} from 'three'
import { Group, Mesh, MeshStandardMaterial, MeshToonMaterial } from 'three'

import { COLSET } from '@/domain/animation/AnimStruct'

import { type ColorInd, type ModelGroup } from '@/types/AnimTypes'

const applyOpaqueRimTint = <T extends MeshStandardMaterial | MeshToonMaterial>(material: T): T => {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float propRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
       outgoingLight += diffuseColor.rgb * propRim * 0.1;
       #include <opaque_fragment>`,
    )
  }
  return material
}

const createPropMaterial = (color: number) =>
  applyOpaqueRimTint(
    new MeshToonMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.015,
    }),
  )

const createFacetedSphere = (radius: number) => {
  const geometry = new SphereGeometry(radius, 20, 20).toNonIndexed()
  geometry.computeVertexNormals()
  return geometry
}

const createTetherMaterial = (color: number) =>
  applyOpaqueRimTint(
    new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.01,
      metalness: 0.035,
      roughness: 0.5,
    }),
  )

const PROP_PATH_RADIUS = 2.4
const RADIAL_GRIP_RADIUS = 0.28
const RADIAL_GRIP_TUBE_RADIUS = 0.055
const RADIAL_SPOKE_START = 0.32
const RADIAL_END_LENGTH = 0.42
const RADIAL_SPOKE_END = PROP_PATH_RADIUS - RADIAL_END_LENGTH / 2

export const NONE = (/*multi: number, color: ColorInd, girth: number*/): ModelGroup => {
    const emptyGroup = new Group() as ModelGroup
    emptyGroup.size = 0
    return emptyGroup
  },
  POI = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!

    const cylinder = new Mesh(
      new CylinderGeometry(0.05 * multi * girth, 0.05 * multi * girth, 2.7 * multi, 32),
      createTetherMaterial(cset[2]),
    )
    cylinder.position.y = 1.2 * multi

    const handle = new Mesh(createFacetedSphere(0.06 * multi * girth), createPropMaterial(cset[1]))
    handle.position.y = -0.12 * multi

    const head = new Mesh(createFacetedSphere(0.2 * multi * girth), createPropMaterial(cset[0]))
    head.position.y = 2.4 * multi
    /*
    const test1 = new Mesh(
        new SphereGeometry(0.06 * multi, 20, 20),
        new MeshBasicMaterial({color: 0xFF0000 })
    )
    test1.position.z = -0.5 * multi
    test1.position.y = 1 * multi

    const test2 = new Mesh(
        new SphereGeometry(0.06 * multi, 20, 20),
        new MeshBasicMaterial({color: 0xFF0000 })
    )
    test2.position.z = 0.5 * multi
    test2.position.y = 1 * multi
*/
    const model2 = new Group() as ModelGroup
    model2.add(cylinder)
    model2.add(head)
    model2.add(handle)
    //model2.add( test1 )
    //model2.add( test2 )

    model2.size = PROP_PATH_RADIUS * multi // Used for Y offset manipulations, multiplied by -1 to 1

    return model2
  },
  STAFF = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!

    const cylinder = new Mesh(
      new CylinderGeometry(0.05 * multi * girth, 0.05 * multi * girth, 4.8 * multi, 32),
      createTetherMaterial(cset[2]),
    )
    cylinder.position.y = 0

    const handle = new Mesh(createFacetedSphere(0.06 * multi * girth), createPropMaterial(cset[1]))
    handle.position.y = -0.12 * multi

    const head1 = new Mesh(createFacetedSphere(0.2 * multi * girth), createPropMaterial(cset[0]))
    head1.position.y = 2.4 * multi

    const head2 = new Mesh(createFacetedSphere(0.2 * multi * girth), createPropMaterial(cset[1]))
    head2.position.y = -2.4 * multi

    const model2 = new Group() as ModelGroup
    model2.add(cylinder)
    model2.add(head1)
    model2.add(head2)

    model2.size = PROP_PATH_RADIUS * multi // Used for Y offset manipulations, multiplied by -1 to 1
    model2.additionalPathHeadPositions = [[0, -1, 0]]

    return model2
  },
  CLUBS = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!

    const knobRadius = 0.12 * multi * girth
    const knob = new Mesh(createFacetedSphere(knobRadius), createPropMaterial(cset[1]))
    // Match the Poi handle's lower extent for every girth setting.
    knob.position.y = (-0.12 + 0.06 * girth) * multi

    const handle = new Mesh(
      new CylinderGeometry(0.075 * multi * girth, 0.095 * multi * girth, 0.88 * multi, 32),
      createTetherMaterial(cset[2]),
    )
    handle.position.y = 0.38 * multi

    const bodyProfile = new SplineCurve([
      new Vector2(0.09 * multi * girth, 0.82 * multi),
      new Vector2(0.13 * multi * girth, 0.92 * multi),
      new Vector2(0.2 * multi * girth, 1.2 * multi),
      new Vector2(0.235 * multi * girth, 1.42 * multi),
      new Vector2(0.22 * multi * girth, 1.62 * multi),
      new Vector2(0.16 * multi * girth, 1.95 * multi),
      new Vector2(0.11 * multi * girth, 2.28 * multi),
      new Vector2(0.1 * multi * girth, 2.4 * multi),
    ])
    const body = new Mesh(
      new LatheGeometry(bodyProfile.getPoints(24), 32),
      createPropMaterial(cset[0]),
    )

    const tipRadius = 0.1 * multi * girth
    const tip = new Mesh(createFacetedSphere(tipRadius), createPropMaterial(cset[1]))
    // Match the Poi head's upper extent for every girth setting.
    tip.position.y = (2.4 + 0.1 * girth) * multi

    const model = new Group() as ModelGroup
    model.add(knob, handle, body, tip)
    model.size = PROP_PATH_RADIUS * multi // Used for Y offset manipulations, multiplied by -1 to 1

    return model
  },
  FANS = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!
    const model = new Group() as ModelGroup
    const frameMaterial = createTetherMaterial(cset[2])
    const wickMaterial = createPropMaterial(cset[0])
    const frameRadius = 0.045 * multi * girth
    const spokeStart = RADIAL_SPOKE_START * multi
    const spokeEnd = RADIAL_SPOKE_END * multi
    const wickLength = RADIAL_END_LENGTH * multi

    const ring = new Mesh(
      new TorusGeometry(
        RADIAL_GRIP_RADIUS * multi,
        RADIAL_GRIP_TUBE_RADIUS * multi * girth,
        12,
        32,
      ),
      frameMaterial,
    )
    model.add(ring)

    for (const angle of [-60, -30, 0, 30, 60]) {
      const radians = (angle * Math.PI) / 180
      const spoke = new Mesh(
        new CylinderGeometry(frameRadius, frameRadius, spokeEnd - spokeStart, 12),
        frameMaterial,
      )
      const spokeMidpoint = (spokeStart + spokeEnd) / 2
      spoke.position.set(Math.sin(radians) * spokeMidpoint, Math.cos(radians) * spokeMidpoint, 0)
      spoke.rotation.z = -radians

      const wick = new Mesh(
        new CylinderGeometry(0.13 * multi * girth, 0.13 * multi * girth, wickLength, 16),
        wickMaterial,
      )
      const wickMidpoint = spokeEnd + wickLength / 2
      wick.position.set(Math.sin(radians) * wickMidpoint, Math.cos(radians) * wickMidpoint, 0)
      wick.rotation.z = -radians
      model.add(spoke, wick)
    }

    for (const radius of [1.1, 1.58]) {
      const brace = new Mesh(
        new TorusGeometry(radius * multi, frameRadius, 8, 32, (Math.PI * 2) / 3),
        frameMaterial,
      )
      brace.rotation.z = Math.PI / 6
      model.add(brace)
    }

    model.size = PROP_PATH_RADIUS * multi
    model.additionalPathHeadPositions = [-60, -30, 30, 60].map((angle) => {
      const radians = (angle * Math.PI) / 180
      return [Math.sin(radians), Math.cos(radians), 0] as const
    })
    return model
  },
  TRIADS = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!
    const model = new Group() as ModelGroup
    const frameMaterial = createTetherMaterial(cset[2])
    const endMaterial = createPropMaterial(cset[0])
    const frameRadius = 0.045 * multi * girth
    const spokeStart = RADIAL_SPOKE_START * multi
    const spokeEnd = RADIAL_SPOKE_END * multi
    const endLength = RADIAL_END_LENGTH * multi

    const ring = new Mesh(
      new TorusGeometry(
        RADIAL_GRIP_RADIUS * multi,
        RADIAL_GRIP_TUBE_RADIUS * multi * girth,
        12,
        32,
      ),
      frameMaterial,
    )
    model.add(ring)

    for (const angle of [0, 120, 240]) {
      const radians = (angle * Math.PI) / 180
      const spoke = new Mesh(
        new CylinderGeometry(frameRadius, frameRadius, spokeEnd - spokeStart, 12),
        frameMaterial,
      )
      const spokeMidpoint = (spokeStart + spokeEnd) / 2
      spoke.position.set(Math.sin(radians) * spokeMidpoint, Math.cos(radians) * spokeMidpoint, 0)
      spoke.rotation.z = -radians

      const end = new Mesh(
        new CylinderGeometry(0.13 * multi * girth, 0.13 * multi * girth, endLength, 16),
        endMaterial,
      )
      const endMidpoint = spokeEnd + endLength / 2
      end.position.set(Math.sin(radians) * endMidpoint, Math.cos(radians) * endMidpoint, 0)
      end.rotation.z = -radians
      model.add(spoke, end)
    }

    model.size = PROP_PATH_RADIUS * multi
    model.additionalPathHeadPositions = [120, 240].map((angle) => {
      const radians = (angle * Math.PI) / 180
      return [Math.sin(radians), Math.cos(radians), 0] as const
    })
    return model
  }
